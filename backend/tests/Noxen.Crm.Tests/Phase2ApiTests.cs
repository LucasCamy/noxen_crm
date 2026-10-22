using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Common;
using Noxen.Crm.Api.Finance;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Marketing;
using Noxen.Crm.Domain.Outbox;
using Noxen.Crm.Infrastructure.Finance;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Tests;

[Collection("api")]
public class FinanceApiTests(ApiFactory factory)
{
    private static string ThisMonth => DateTime.UtcNow.ToString("yyyy-MM");
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private static async Task<T> ReadAsync<T>(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<T>(Json.Options))!;

    private static async Task<ClientResponse> NewClientAsync(HttpClient http, decimal monthly = 1500, int dueDay = 10, bool active = false)
    {
        var r = await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Cliente {Guid.NewGuid():N}", MonthlyFee = monthly, DueDay = dueDay }, Json.Options);
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var client = await ReadAsync<ClientResponse>(r);
        if (!active) return client;
        return await ReadAsync<ClientResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/status", new ChangeClientStatusRequest(ClientStatus.Ativo, client.Version), Json.Options));
    }

    private static PaymentInput Charge(decimal amount, DateOnly due, int monthOffset = 0) => new()
    {
        Kind = PaymentKind.Mensalidade,
        ReferenceMonth = new DateOnly(due.Year, due.Month, 1).AddMonths(monthOffset),
        Amount = amount,
        DueDate = due,
    };

    [Fact]
    public async Task Finance_is_blocked_for_marketing_and_anonymous_users()
    {
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);
        foreach (var url in new[] { "/api/payments", "/api/ledger", "/api/finance/summary" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await marketing.GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(url)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await marketing.PostAsJsonAsync("/api/ledger", new LedgerInput { Description = "x", Amount = 1, Date = Today }, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Charge_generation_is_admin_only()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        Assert.Equal(HttpStatusCode.Forbidden, (await comercial.PostAsync("/api/finance/charges/generate?month=2031-01", null)).StatusCode);
    }

    [Fact]
    public async Task Payment_lifecycle_pay_conflict_and_rules()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(http);

        var created = await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(1500, Today.AddDays(-5)), Json.Options);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var payment = await ReadAsync<PaymentResponse>(created);
        Assert.True(payment.Overdue);
        Assert.Equal(client.Name, payment.ClientName);

        var overdueList = await http.GetFromJsonAsync<PagedResult<PaymentResponse>>($"/api/payments?clientId={client.Id}&status=Atrasado", Json.Options);
        Assert.Single(overdueList!.Items);

        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await http.PostAsJsonAsync($"/api/payments/{payment.Id}/pay", new PayRequest(Today.AddDays(2), payment.Version), Json.Options)).StatusCode);

        var paid = await ReadAsync<PaymentResponse>(await http.PostAsJsonAsync($"/api/payments/{payment.Id}/pay", new PayRequest(null, payment.Version), Json.Options));
        Assert.Equal(PaymentStatus.Pago, paid.Status);
        Assert.Equal(Today, paid.PaidOn);
        Assert.False(paid.Overdue);

        // já pago: regra de negócio (pagar de novo e cancelar)
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync($"/api/payments/{payment.Id}/pay", new PayRequest(null, paid.Version), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync($"/api/payments/{payment.Id}/cancel", new VersionRequest(paid.Version), Json.Options)).StatusCode);

        // edição com versão antiga em uma cobrança pendente: conflito
        var other = await ReadAsync<PaymentResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(500, Today.AddDays(5), monthOffset: 1), Json.Options));
        var edit = new UpdatePaymentRequest(550, Today.AddDays(6), "Ajuste", other.Version);
        Assert.Equal(HttpStatusCode.OK, (await http.PutAsJsonAsync($"/api/payments/{other.Id}", edit, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.PutAsJsonAsync($"/api/payments/{other.Id}", edit, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Only_one_active_monthly_charge_per_client_and_month_but_cancelled_frees_the_slot()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(http);
        var due = new DateOnly(2031, 5, 10);

        var first = await ReadAsync<PaymentResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(1500, due), Json.Options));
        Assert.Equal(HttpStatusCode.Conflict, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(1500, due), Json.Options)).StatusCode);

        // cobranças avulsas do mesmo mês não conflitam
        var extra = Charge(300, due);
        var avulsa = new PaymentInput { Kind = PaymentKind.Avulso, ReferenceMonth = extra.ReferenceMonth, Amount = 300, DueDate = due };
        Assert.Equal(HttpStatusCode.Created, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", avulsa, Json.Options)).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await http.PostAsJsonAsync($"/api/payments/{first.Id}/cancel", new VersionRequest(first.Version), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(1600, due), Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Payment_validation_and_not_found()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(http);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(0, Today), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync($"/api/clients/{Guid.NewGuid()}/payments", Charge(10, Today), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.GetAsync("/api/payments?month=2026-13")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync($"/api/payments/{Guid.NewGuid()}/cancel", new VersionRequest(1), Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Summary_combines_paid_charges_and_ledger_into_the_month_result()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var before = await http.GetFromJsonAsync<FinanceSummary>($"/api/finance/summary?month={ThisMonth}", Json.Options);

        var client = await NewClientAsync(http);
        var payment = await ReadAsync<PaymentResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(2000, Today), Json.Options));
        await http.PostAsJsonAsync($"/api/payments/{payment.Id}/pay", new PayRequest(null, payment.Version), Json.Options);

        var revenue = await ReadAsync<LedgerResponse>(await http.PostAsJsonAsync("/api/ledger", new LedgerInput { Kind = LedgerKind.Receita, Date = Today, Description = "Projeto avulso", Amount = 500 }, Json.Options));
        await http.PostAsJsonAsync($"/api/ledger/{revenue.Id}/settle", new SettleRequest(null, revenue.Version), Json.Options);
        var expense = await ReadAsync<LedgerResponse>(await http.PostAsJsonAsync("/api/ledger", new LedgerInput { Kind = LedgerKind.Despesa, Date = Today, Description = "Ferramentas", Category = "Software", Amount = 300 }, Json.Options));
        await http.PostAsJsonAsync($"/api/ledger/{expense.Id}/settle", new SettleRequest(null, expense.Version), Json.Options);
        // previsto e cancelado não entram no realizado
        await http.PostAsJsonAsync("/api/ledger", new LedgerInput { Kind = LedgerKind.Despesa, Date = Today, Description = "Prevista", Amount = 70 }, Json.Options);
        var cancelled = await ReadAsync<LedgerResponse>(await http.PostAsJsonAsync("/api/ledger", new LedgerInput { Kind = LedgerKind.Despesa, Date = Today, Description = "Cancelada", Amount = 900 }, Json.Options));
        await http.PostAsJsonAsync($"/api/ledger/{cancelled.Id}/cancel", new VersionRequest(cancelled.Version), Json.Options);

        var after = await http.GetFromJsonAsync<FinanceSummary>($"/api/finance/summary?month={ThisMonth}", Json.Options);
        Assert.Equal(before!.Received + 2500m, after!.Received);
        Assert.Equal(before.Expenses + 300m, after.Expenses);
        Assert.Equal(before.ExpensesPlanned + 70m, after.ExpensesPlanned);
        Assert.Equal(before.Result + 2200m, after.Result);
    }

    [Fact]
    public async Task Summary_reports_overdue_charges_from_any_month()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var before = await http.GetFromJsonAsync<FinanceSummary>($"/api/finance/summary?month={ThisMonth}", Json.Options);
        var client = await NewClientAsync(http);
        await http.PostAsJsonAsync($"/api/clients/{client.Id}/payments", Charge(777, new DateOnly(2020, 1, 10)), Json.Options);

        var after = await http.GetFromJsonAsync<FinanceSummary>($"/api/finance/summary?month={ThisMonth}", Json.Options);
        Assert.Equal(before!.Overdue + 777m, after!.Overdue);
        Assert.Equal(before.OverdueCount + 1, after.OverdueCount);
    }

    [Fact]
    public async Task Ledger_update_requires_current_version_and_blocks_settled_cancel()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var entry = await ReadAsync<LedgerResponse>(await http.PostAsJsonAsync("/api/ledger", new LedgerInput { Kind = LedgerKind.Despesa, Date = Today, Description = "Domínio", Amount = 60 }, Json.Options));

        var updated = await http.PutAsJsonAsync($"/api/ledger/{entry.Id}", new UpdateLedgerRequest { Kind = LedgerKind.Despesa, Date = Today, Description = "Domínio .com.br", Amount = 65, Version = entry.Version }, Json.Options);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.PutAsJsonAsync($"/api/ledger/{entry.Id}", new UpdateLedgerRequest { Kind = LedgerKind.Despesa, Date = Today, Description = "x", Amount = 1, Version = entry.Version }, Json.Options)).StatusCode);

        var current = await ReadAsync<LedgerResponse>(updated);
        var settled = await ReadAsync<LedgerResponse>(await http.PostAsJsonAsync($"/api/ledger/{entry.Id}/settle", new SettleRequest(null, current.Version), Json.Options));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync($"/api/ledger/{entry.Id}/cancel", new VersionRequest(settled.Version), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/ledger", new LedgerInput { Description = "c", Amount = 1, Date = Today, ClientId = Guid.NewGuid() }, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Charge_generation_bills_active_clients_once_even_with_parallel_runs()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var admin = await factory.AdminAsync();
        var active = await NewClientAsync(http, monthly: 2200, dueDay: 12, active: true);
        var inactive = await NewClientAsync(http, monthly: 900);

        var runs = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => admin.PostAsync("/api/finance/charges/generate?month=2032-07", null)));
        Assert.All(runs, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        var billed = await admin.GetFromJsonAsync<PagedResult<PaymentResponse>>($"/api/payments?clientId={active.Id}&month=2032-07", Json.Options);
        var only = Assert.Single(billed!.Items);
        Assert.Equal(2200m, only.Amount);
        Assert.Equal(new DateOnly(2032, 7, 12), only.DueDate);
        Assert.Equal(PaymentKind.Mensalidade, only.Kind);
        Assert.Empty((await admin.GetFromJsonAsync<PagedResult<PaymentResponse>>($"/api/payments?clientId={inactive.Id}", Json.Options))!.Items);

        var again = await ReadAsync<System.Text.Json.JsonElement>(await admin.PostAsync("/api/finance/charges/generate?month=2032-07", null));
        Assert.Equal(0, again.GetProperty("created").GetInt32());
    }

    [Fact]
    public async Task Maintenance_removes_old_processed_outbox_messages_and_keeps_pending_and_recent_ones()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var now = DateTimeOffset.UtcNow;
        var old = OutboxMessage.Create("test.old", "{}", now.AddDays(-30)); old.MarkProcessed(now.AddDays(-9));
        var recent = OutboxMessage.Create("test.recent", "{}", now.AddDays(-2)); recent.MarkProcessed(now.AddDays(-1));
        var pending = OutboxMessage.Create("test.pending", "{}", now.AddDays(-30));
        db.OutboxMessages.AddRange(old, recent, pending);
        await db.SaveChangesAsync();

        var service = new MaintenanceService(factory.Services.GetRequiredService<IServiceScopeFactory>(), TimeProvider.System, NullLogger<MaintenanceService>.Instance);
        await service.RunOnceAsync(CancellationToken.None);

        var ids = await db.OutboxMessages.AsNoTracking().Select(m => m.Id).ToListAsync();
        Assert.DoesNotContain(old.Id, ids);
        Assert.Contains(recent.Id, ids);
        Assert.Contains(pending.Id, ids);
    }
}

[Collection("api")]
public class ClientActivityApiTests(ApiFactory factory)
{
    private static async Task<T> ReadAsync<T>(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<T>(Json.Options))!;

    private static async Task<ClientResponse> NewClientAsync(HttpClient http)
    {
        var r = await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Cliente {Guid.NewGuid():N}", MonthlyFee = 1500, DueDay = 10 }, Json.Options);
        return await ReadAsync<ClientResponse>(r);
    }

    [Fact]
    public async Task Marketing_can_write_activities_but_everyone_authenticated_can_read()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(comercial);
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);

        var created = await marketing.PostAsJsonAsync($"/api/clients/{client.Id}/results",
            new ResultInput { Month = new DateOnly(2026, 9, 20), AdSpend = 2000, Leads = 80, Sales = 10, Revenue = 14000 }, Json.Options);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var result = await ReadAsync<ResultResponse>(created);
        Assert.Equal(new DateOnly(2026, 9, 1), result.Month);
        Assert.Equal(25m, result.CostPerLead);
        Assert.Equal(200m, result.CostPerSale);
        Assert.Equal(7m, result.Roas);

        Assert.Single(await comercial.GetFromJsonAsync<List<ResultResponse>>($"/api/clients/{client.Id}/results", Json.Options) ?? []);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync($"/api/clients/{client.Id}/results")).StatusCode);
    }

    [Fact]
    public async Task Result_for_the_same_month_conflicts_and_update_needs_the_current_version()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(http);
        var body = new ResultInput { Month = new DateOnly(2026, 8, 1), AdSpend = 1000, Leads = 50, Sales = 5, Revenue = 5000 };
        var first = await ReadAsync<ResultResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/results", body, Json.Options));
        Assert.Equal(HttpStatusCode.Conflict, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/results", body, Json.Options)).StatusCode);

        var upd = new UpdateResultRequest { Month = body.Month, AdSpend = 1200, Leads = 60, Sales = 6, Revenue = 6000, Version = first.Version };
        var ok = await http.PutAsJsonAsync($"/api/results/{first.Id}", upd, Json.Options);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.PutAsJsonAsync($"/api/results/{first.Id}", upd, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/results", new ResultInput { Month = new DateOnly(2026, 7, 1), Leads = -1 }, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Campaign_rules_are_enforced_and_crud_works()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(http);
        var start = new DateOnly(2026, 11, 1);

        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await http.PostAsJsonAsync($"/api/clients/{client.Id}/campaigns", new CampaignInput { Name = "BF", StartDate = start, EndDate = start.AddDays(-1), Budget = 1000 }, Json.Options)).StatusCode);

        var created = await ReadAsync<CampaignResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/campaigns",
            new CampaignInput { Name = "Black Friday", Objective = "Leads no WhatsApp", StartDate = start, EndDate = start.AddDays(30), Budget = 3000, Status = CampaignStatus.Ativa }, Json.Options));
        var updated = await ReadAsync<CampaignResponse>(await http.PutAsJsonAsync($"/api/campaigns/{created.Id}",
            new UpdateCampaignRequest { Name = "Black Friday 2026", StartDate = start, Budget = 3500, Status = CampaignStatus.Pausada, Version = created.Version }, Json.Options));
        Assert.Equal(CampaignStatus.Pausada, updated.Status);

        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/campaigns/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.DeleteAsync($"/api/campaigns/{created.Id}")).StatusCode);
        Assert.Empty(await http.GetFromJsonAsync<List<CampaignResponse>>($"/api/clients/{client.Id}/campaigns", Json.Options) ?? []);
    }

    [Fact]
    public async Task Meetings_are_listed_newest_first_and_validate_input()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await NewClientAsync(http);
        var older = DateTimeOffset.UtcNow.AddDays(-10);
        var newer = DateTimeOffset.UtcNow.AddDays(-1);

        await http.PostAsJsonAsync($"/api/clients/{client.Id}/meetings", new MeetingInput { HeldAt = older, Subject = "Kickoff", Notes = "Alinhamento inicial" }, Json.Options);
        var second = await ReadAsync<MeetingResponse>(await http.PostAsJsonAsync($"/api/clients/{client.Id}/meetings", new MeetingInput { HeldAt = newer, Subject = "Revisão", NextSteps = "Subir novos criativos" }, Json.Options));
        Assert.NotNull(second.CreatedById);

        var list = await http.GetFromJsonAsync<List<MeetingResponse>>($"/api/clients/{client.Id}/meetings", Json.Options);
        Assert.Equal(["Revisão", "Kickoff"], list!.Select(m => m.Subject).ToArray());

        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync($"/api/clients/{client.Id}/meetings", new MeetingInput { HeldAt = newer, Subject = "" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync($"/api/clients/{Guid.NewGuid()}/meetings", new MeetingInput { HeldAt = newer, Subject = "x" }, Json.Options)).StatusCode);
    }
}

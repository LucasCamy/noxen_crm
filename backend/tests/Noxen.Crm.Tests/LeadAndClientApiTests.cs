using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Common;
using Noxen.Crm.Api.Dashboard;
using Noxen.Crm.Api.Leads;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Infrastructure.Messaging;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Tests;

[Collection("api")]
public class LeadAndClientApiTests(ApiFactory factory)
{
    private static LeadInput NewLead(string? company = null) => new()
    {
        Company = company ?? $"Empresa {Guid.NewGuid():N}",
        Whatsapp = "67999990000",
        City = "Campo Grande",
        State = "MS",
        Source = LeadSource.Instagram,
        EstimatedValue = 5000,
    };

    private static async Task<LeadResponse> CreateLeadAsync(HttpClient http, LeadInput? input = null)
    {
        var response = await http.PostAsJsonAsync("/api/leads", input ?? NewLead(), Json.Options);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LeadResponse>(Json.Options))!;
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(Json.Options))!;

    [Fact]
    public async Task Marketing_can_read_but_not_write()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(comercial);
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);

        Assert.Equal(HttpStatusCode.OK, (await marketing.GetAsync($"/api/leads/{lead.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await marketing.PostAsJsonAsync("/api/leads", NewLead(), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await marketing.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Contatado, null, lead.Version), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await marketing.PostAsJsonAsync("/api/clients", new ClientInput { Name = "X", DueDay = 10 }, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Create_validates_input_and_defaults_owner_to_the_caller()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await http.PostAsJsonAsync("/api/leads", new LeadInput { Company = "" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await http.PostAsJsonAsync("/api/leads", new LeadInput { Company = "Ok", State = "MSX" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await http.PostAsJsonAsync("/api/leads", new LeadInput { Company = "Ok", EstimatedValue = -5 }, Json.Options)).StatusCode);

        var lead = await CreateLeadAsync(http);
        Assert.NotNull(lead.OwnerId);
        Assert.Equal(LeadStage.AContatar, lead.Stage);
    }

    [Fact]
    public async Task Stage_changes_follow_the_funnel_rules_and_are_recorded()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(http);

        var contacted = await ReadAsync<LeadResponse>(
            await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Contatado, null, lead.Version), Json.Options));
        Assert.Equal(LeadStage.Contatado, contacted.Stage);

        var noReason = await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Perdido, null, contacted.Version), Json.Options);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, noReason.StatusCode);

        var closedDirectly = await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Fechado, null, contacted.Version), Json.Options);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, closedDirectly.StatusCode);

        var lost = await ReadAsync<LeadResponse>(
            await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Perdido, "Sem orçamento", contacted.Version), Json.Options));
        Assert.Equal("Sem orçamento", lost.LostReason);

        var history = await http.GetFromJsonAsync<List<LeadStageChangeResponse>>($"/api/leads/{lead.Id}/history", Json.Options);
        Assert.Equal([LeadStage.Contatado, LeadStage.Perdido], history!.Select(h => h.To).ToArray());
    }

    [Fact]
    public async Task Update_with_stale_version_returns_conflict()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(http);

        var first = await http.PutAsJsonAsync($"/api/leads/{lead.Id}",
            new UpdateLeadRequest { Company = "Nome novo", Source = LeadSource.Indicacao, Version = lead.Version }, Json.Options);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var updated = await ReadAsync<LeadResponse>(first);
        Assert.NotEqual(lead.Version, updated.Version);

        var stale = await http.PutAsJsonAsync($"/api/leads/{lead.Id}",
            new UpdateLeadRequest { Company = "Outro nome", Source = LeadSource.Indicacao, Version = lead.Version }, Json.Options);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);

        var current = await http.GetFromJsonAsync<LeadResponse>($"/api/leads/{lead.Id}", Json.Options);
        Assert.Equal("Nome novo", current!.Company);
    }

    [Fact]
    public async Task List_filters_searches_and_paginates()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var marker = $"Zeta{Guid.NewGuid():N}";
        for (var i = 0; i < 3; i++) await CreateLeadAsync(http, NewLead($"{marker} loja {i}"));
        await CreateLeadAsync(http, NewLead($"{marker}_100% literal"));

        var page = await http.GetFromJsonAsync<PagedResult<LeadResponse>>($"/api/leads?search={marker}&pageSize=2&page=2", Json.Options);
        Assert.Equal(4, page!.Total);
        Assert.Equal(2, page.Items.Count);

        // Curingas do usuário são escapados: "%" e "_" valem como texto.
        var literal = await http.GetFromJsonAsync<PagedResult<LeadResponse>>($"/api/leads?search={Uri.EscapeDataString("100%")}", Json.Options);
        Assert.True(literal!.Items.Any(l => l.Company.StartsWith(marker)), $"total={literal.Total} items={string.Join("; ", literal.Items.Select(i => i.Company))}");
        var noMatch = await http.GetFromJsonAsync<PagedResult<LeadResponse>>($"/api/leads?search={Uri.EscapeDataString("%")}%20{marker}", Json.Options);
        Assert.Empty(noMatch!.Items);

        var capped = await http.GetFromJsonAsync<PagedResult<LeadResponse>>("/api/leads?pageSize=100000", Json.Options);
        Assert.Equal(Paging.MaxPageSize, capped!.PageSize);
    }

    [Fact]
    public async Task Convert_creates_the_client_once_even_with_parallel_requests()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(http);
        var body = new ConvertLeadRequest(5000, 1500, 10, null);

        var responses = await Task.WhenAll(Enumerable.Range(0, 6)
            .Select(_ => http.PostAsJsonAsync($"/api/leads/{lead.Id}/convert", body, Json.Options)));

        Assert.All(responses, r => Assert.True(r.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK, $"status {r.StatusCode}"));
        var clients = await Task.WhenAll(responses.Select(ReadAsync<ClientResponse>));
        Assert.Single(clients.Select(c => c.Id).Distinct());
        Assert.Equal(lead.Company, clients[0].Name);
        Assert.Equal(lead.Id, clients[0].LeadId);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        Assert.Equal(1, await db.Clients.CountAsync(c => c.LeadId == lead.Id));
        Assert.Equal(LeadStage.Fechado, (await db.Leads.SingleAsync(l => l.Id == lead.Id)).Stage);
        Assert.Equal(1, await db.LeadStageChanges.CountAsync(h => h.LeadId == lead.Id && h.ToStage == LeadStage.Fechado));
        var outbox = await db.OutboxMessages.AsNoTracking().ToListAsync();
        Assert.Equal(1, outbox.Count(m => m.Type == EventTypes.LeadConverted && m.Payload.Contains(lead.Id.ToString())));
    }

    [Fact]
    public async Task Convert_rejects_a_lost_lead_and_invalid_fees()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(http);
        var lost = await ReadAsync<LeadResponse>(
            await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Perdido, "Fechou com outro", lead.Version), Json.Options));

        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await http.PostAsJsonAsync($"/api/leads/{lost.Id}/convert", new ConvertLeadRequest(5000, 1500, 10, null), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await http.PostAsJsonAsync($"/api/leads/{lost.Id}/convert", new ConvertLeadRequest(5000, 1500, 31, null), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await http.PostAsJsonAsync($"/api/leads/{Guid.NewGuid()}/convert", new ConvertLeadRequest(1, 1, 10, null), Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Mutations_write_events_to_the_outbox_in_the_same_transaction()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(http);
        await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Contatado, null, lead.Version), Json.Options);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var types = (await db.OutboxMessages.AsNoTracking().ToListAsync())
            .Where(m => m.Payload.Contains(lead.Id.ToString())).Select(m => m.Type).ToList();
        Assert.Contains(EventTypes.LeadCreated, types);
        Assert.Contains(EventTypes.LeadStageChanged, types);
    }

    [Fact]
    public async Task Client_duplicate_cnpj_is_a_conflict_and_stale_update_is_rejected()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var cnpj = Random.Shared.NextInt64(10_000_000_000_000, 99_999_999_999_999).ToString();

        var created = await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = "Cliente A", Cnpj = cnpj, MonthlyFee = 1500, DueDay = 5 }, Json.Options);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var client = await ReadAsync<ClientResponse>(created);

        var duplicate = await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = "Cliente B", Cnpj = cnpj, DueDay = 5 }, Json.Options);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var ok = await http.PutAsJsonAsync($"/api/clients/{client.Id}",
            new UpdateClientRequest { Name = "Cliente A2", Cnpj = cnpj, MonthlyFee = 2000, DueDay = 5, Version = client.Version }, Json.Options);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var stale = await http.PutAsJsonAsync($"/api/clients/{client.Id}",
            new UpdateClientRequest { Name = "Cliente A3", Cnpj = cnpj, MonthlyFee = 2500, DueDay = 5, Version = client.Version }, Json.Options);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
    }

    [Fact]
    public async Task Dashboard_counts_only_active_clients_in_mrr_and_the_cache_can_be_invalidated()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        await factory.ClearCacheAsync();
        var before = await http.GetFromJsonAsync<PortfolioSummary>("/api/dashboard/portfolio", Json.Options);

        var created = await ReadAsync<ClientResponse>(
            await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"MRR {Guid.NewGuid():N}", MonthlyFee = 1500, DueDay = 5 }, Json.Options));

        // Ainda em implantação e com o painel em cache: nada muda.
        var cached = await http.GetFromJsonAsync<PortfolioSummary>("/api/dashboard/portfolio", Json.Options);
        Assert.Equal(before!.Mrr, cached!.Mrr);
        await factory.ClearCacheAsync();
        var implementing = await http.GetFromJsonAsync<PortfolioSummary>("/api/dashboard/portfolio", Json.Options);
        Assert.Equal(before.Mrr, implementing!.Mrr);
        Assert.Equal(before.ActiveClients, implementing.ActiveClients);

        var active = await ReadAsync<ClientResponse>(
            await http.PostAsJsonAsync($"/api/clients/{created.Id}/status", new ChangeClientStatusRequest(ClientStatus.Ativo, created.Version), Json.Options));
        await factory.ClearCacheAsync();
        var after = await http.GetFromJsonAsync<PortfolioSummary>("/api/dashboard/portfolio", Json.Options);
        Assert.Equal(before.Mrr + 1500m, after!.Mrr);
        Assert.Equal(before.ActiveClients + 1, after.ActiveClients);
        Assert.Equal(10, after.TargetClients);

        await http.PostAsJsonAsync($"/api/clients/{active.Id}/status", new ChangeClientStatusRequest(ClientStatus.Pausado, active.Version), Json.Options);
        await factory.ClearCacheAsync();
        var paused = await http.GetFromJsonAsync<PortfolioSummary>("/api/dashboard/portfolio", Json.Options);
        Assert.Equal(before.Mrr, paused!.Mrr);
    }
}

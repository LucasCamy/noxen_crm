using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Api.Common;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Infrastructure.Finance;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Finance;

public record PaymentInput
{
    public PaymentKind Kind { get; init; } = PaymentKind.Mensalidade;
    /// <summary>Qualquer dia do mês de referência (é normalizado para o dia 1).</summary>
    public DateOnly ReferenceMonth { get; init; }
    [Range(0.01, 1_000_000_000)] public decimal Amount { get; init; }
    public DateOnly DueDate { get; init; }
    [MaxLength(300)] public string? Description { get; init; }
}

public sealed record UpdatePaymentRequest(
    [property: Range(0.01, 1_000_000_000)] decimal Amount, DateOnly DueDate, [property: MaxLength(300)] string? Description, uint Version);

public sealed record PayRequest(DateOnly? PaidOn, uint Version);
public sealed record VersionRequest(uint Version);

public sealed record PaymentResponse(
    Guid Id, Guid ClientId, string ClientName, PaymentKind Kind, DateOnly ReferenceMonth, string? Description, decimal Amount,
    DateOnly DueDate, DateOnly? PaidOn, PaymentStatus Status, bool Overdue, uint Version)
{
    public static PaymentResponse From(Payment p, string clientName, DateOnly today) => new(
        p.Id, p.ClientId, clientName, p.Kind, p.ReferenceMonth, p.Description, p.Amount, p.DueDate, p.PaidOn, p.Status,
        p.IsOverdue(today), p.Version);
}

public record LedgerInput
{
    public LedgerKind Kind { get; init; }
    public DateOnly Date { get; init; }
    [Required, MaxLength(300)] public string Description { get; init; } = "";
    [MaxLength(100)] public string? Category { get; init; }
    [Range(0.01, 1_000_000_000)] public decimal Amount { get; init; }
    public Guid? ClientId { get; init; }
}

public sealed record UpdateLedgerRequest : LedgerInput
{
    public uint Version { get; init; }
}

public sealed record SettleRequest(DateOnly? SettledOn, uint Version);

public sealed record LedgerResponse(
    Guid Id, LedgerKind Kind, DateOnly Date, string Description, string? Category, decimal Amount, Guid? ClientId,
    string? ClientName, LedgerStatus Status, DateOnly? SettledOn, bool Overdue, uint Version)
{
    public static LedgerResponse From(LedgerEntry e, string? clientName, DateOnly today) => new(
        e.Id, e.Kind, e.Date, e.Description, e.Category, e.Amount, e.ClientId, clientName, e.Status, e.SettledOn,
        e.IsOverdue(today), e.Version);
}

public sealed record FinanceSummary(
    string Month, decimal Received, decimal Expected, decimal Overdue, int OverdueCount, decimal Expenses,
    decimal ExpensesPlanned, decimal Result);

public static class FinanceEndpoints
{
    public static void MapFinance(this IEndpointRouteBuilder app)
    {
        var finance = app.MapGroup("/api").WithTags("Finance").RequireAuthorization(Policies.CanManageFinance);

        finance.MapGet("/payments", ListPayments);
        finance.MapPost("/clients/{clientId:guid}/payments", CreatePayment);
        finance.MapPut("/payments/{id:guid}", UpdatePayment);
        finance.MapPost("/payments/{id:guid}/pay", PayPayment);
        finance.MapPost("/payments/{id:guid}/cancel", CancelPayment);

        finance.MapGet("/ledger", ListLedger);
        finance.MapPost("/ledger", CreateLedger);
        finance.MapPut("/ledger/{id:guid}", UpdateLedger);
        finance.MapPost("/ledger/{id:guid}/settle", SettleLedger);
        finance.MapPost("/ledger/{id:guid}/cancel", CancelLedger);

        finance.MapGet("/finance/summary", Summary);
        app.MapPost("/api/finance/charges/generate", GenerateCharges).WithTags("Finance").RequireAuthorization(Policies.AdminOnly);
    }

    private static bool TryMonth(string? text, TimeProvider clock, out DateOnly first)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            var now = clock.GetUtcNow();
            first = new DateOnly(now.Year, now.Month, 1);
            return true;
        }
        return DateOnly.TryParseExact(text + "-01", "yyyy-MM-dd", out first);
    }

    private static IResult BadMonth() => Results.Problem(statusCode: 400, title: "Mês inválido. Use o formato AAAA-MM.");
    private static DateOnly Today(TimeProvider clock) => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

    // ------------------------------------------------------------ cobranças

    private static async Task<IResult> ListPayments(
        CrmDbContext db, TimeProvider clock, string? month, Guid? clientId, string? status, int page = 1, int pageSize = 50)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var today = Today(clock);
        var query = db.Payments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(month))
        {
            if (!TryMonth(month, clock, out var first)) return BadMonth();
            var next = first.AddMonths(1);
            query = query.Where(p => p.DueDate >= first && p.DueDate < next);
        }
        if (clientId is not null) query = query.Where(p => p.ClientId == clientId);
        query = status switch
        {
            null or "" => query,
            "Atrasado" => query.Where(p => p.Status == PaymentStatus.Pendente && p.DueDate < today),
            _ when Enum.TryParse<PaymentStatus>(status, out var st) => query.Where(p => p.Status == st),
            _ => query,
        };

        var total = await query.CountAsync();
        var rows = await query.OrderBy(p => p.DueDate).ThenBy(p => p.Id)
            .Join(db.Clients, p => p.ClientId, c => c.Id, (p, c) => new { Payment = p, c.Name })
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Results.Ok(new PagedResult<PaymentResponse>(rows.Select(r => PaymentResponse.From(r.Payment, r.Name, today)).ToList(), total, page, pageSize));
    }

    private static async Task<IResult> CreatePayment(Guid clientId, PaymentInput input, CrmDbContext db, TimeProvider clock)
    {
        var client = await db.Clients.AsNoTracking().Where(c => c.Id == clientId).Select(c => new { c.Name }).SingleOrDefaultAsync();
        if (client is null) return Results.NotFound();
        var payment = Payment.Create(clientId, input.Kind, input.ReferenceMonth, input.Amount, input.DueDate, input.Description, clock.GetUtcNow());
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return Results.Created($"/api/payments/{payment.Id}", PaymentResponse.From(payment, client.Name, Today(clock)));
    }

    private static async Task<IResult> UpdatePayment(Guid id, UpdatePaymentRequest req, CrmDbContext db, TimeProvider clock) =>
        await MutatePayment(id, req.Version, db, clock, (p, now) => p.UpdateDetails(req.Amount, req.DueDate, req.Description, now));

    private static async Task<IResult> PayPayment(Guid id, PayRequest req, CrmDbContext db, TimeProvider clock) =>
        await MutatePayment(id, req.Version, db, clock, (p, now) =>
        {
            var today = Today(clock);
            p.MarkPaid(req.PaidOn ?? today, today, now);
        });

    private static async Task<IResult> CancelPayment(Guid id, VersionRequest req, CrmDbContext db, TimeProvider clock) =>
        await MutatePayment(id, req.Version, db, clock, (p, now) => p.Cancel(now));

    private static async Task<IResult> MutatePayment(Guid id, uint version, CrmDbContext db, TimeProvider clock, Action<Payment, DateTimeOffset> change)
    {
        var payment = await db.Payments.SingleOrDefaultAsync(p => p.Id == id);
        if (payment is null) return Results.NotFound();
        db.Entry(payment).Property(p => p.Version).OriginalValue = version;
        change(payment, clock.GetUtcNow());
        await db.SaveChangesAsync();
        var name = await db.Clients.AsNoTracking().Where(c => c.Id == payment.ClientId).Select(c => c.Name).SingleAsync();
        return Results.Ok(PaymentResponse.From(payment, name, Today(clock)));
    }

    // ------------------------------------------------------------ lançamentos

    private static async Task<IResult> ListLedger(
        CrmDbContext db, TimeProvider clock, string? month, LedgerKind? kind, string? status, int page = 1, int pageSize = 50)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var today = Today(clock);
        var query = db.LedgerEntries.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(month))
        {
            if (!TryMonth(month, clock, out var first)) return BadMonth();
            var next = first.AddMonths(1);
            query = query.Where(e => e.Date >= first && e.Date < next);
        }
        if (kind is not null) query = query.Where(e => e.Kind == kind);
        query = status switch
        {
            null or "" => query,
            "Atrasado" => query.Where(e => e.Status == LedgerStatus.Previsto && e.Date < today),
            _ when Enum.TryParse<LedgerStatus>(status, out var st) => query.Where(e => e.Status == st),
            _ => query,
        };

        var total = await query.CountAsync();
        var rows = await query.OrderBy(e => e.Date).ThenBy(e => e.Id)
            .GroupJoin(db.Clients, e => e.ClientId, c => c.Id, (e, cs) => new { Entry = e, Clients = cs })
            .SelectMany(x => x.Clients.DefaultIfEmpty(), (x, c) => new { x.Entry, ClientName = c == null ? null : c.Name })
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Results.Ok(new PagedResult<LedgerResponse>(rows.Select(r => LedgerResponse.From(r.Entry, r.ClientName, today)).ToList(), total, page, pageSize));
    }

    private static async Task<IResult> CreateLedger(LedgerInput input, CrmDbContext db, TimeProvider clock)
    {
        if (input.ClientId is not null && !await db.Clients.AnyAsync(c => c.Id == input.ClientId))
            return Results.Problem(statusCode: 422, title: "Cliente não encontrado.");
        var entry = LedgerEntry.Create(input.Kind, input.Date, input.Description, input.Category, input.Amount, input.ClientId, clock.GetUtcNow());
        db.LedgerEntries.Add(entry);
        await db.SaveChangesAsync();
        return Results.Created($"/api/ledger/{entry.Id}", await ToLedgerResponse(db, entry, clock));
    }

    private static async Task<IResult> UpdateLedger(Guid id, UpdateLedgerRequest req, CrmDbContext db, TimeProvider clock) =>
        await MutateLedger(id, req.Version, db, clock, async (e, now) =>
        {
            if (req.ClientId is not null && !await db.Clients.AnyAsync(c => c.Id == req.ClientId))
                throw new Noxen.Crm.Domain.DomainException("Cliente não encontrado.");
            e.Update(req.Date, req.Description, req.Category, req.Amount, req.ClientId, now);
        });

    private static async Task<IResult> SettleLedger(Guid id, SettleRequest req, CrmDbContext db, TimeProvider clock) =>
        await MutateLedger(id, req.Version, db, clock, (e, now) =>
        {
            var today = Today(clock);
            e.Settle(req.SettledOn ?? today, today, now);
            return Task.CompletedTask;
        });

    private static async Task<IResult> CancelLedger(Guid id, VersionRequest req, CrmDbContext db, TimeProvider clock) =>
        await MutateLedger(id, req.Version, db, clock, (e, now) =>
        {
            e.Cancel(now);
            return Task.CompletedTask;
        });

    private static async Task<IResult> MutateLedger(Guid id, uint version, CrmDbContext db, TimeProvider clock, Func<LedgerEntry, DateTimeOffset, Task> change)
    {
        var entry = await db.LedgerEntries.SingleOrDefaultAsync(e => e.Id == id);
        if (entry is null) return Results.NotFound();
        db.Entry(entry).Property(e => e.Version).OriginalValue = version;
        await change(entry, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(await ToLedgerResponse(db, entry, clock));
    }

    private static async Task<LedgerResponse> ToLedgerResponse(CrmDbContext db, LedgerEntry e, TimeProvider clock)
    {
        var name = e.ClientId is null ? null : await db.Clients.AsNoTracking().Where(c => c.Id == e.ClientId).Select(c => c.Name).SingleOrDefaultAsync();
        return LedgerResponse.From(e, name, Today(clock));
    }

    // ------------------------------------------------------------ resumo e geração

    /// <summary>
    /// Caixa do mês: recebido = cobranças pagas no mês + receitas avulsas realizadas no mês; previsto = o que vence no mês e
    /// ainda não foi pago; em atraso = cobranças pendentes já vencidas (de qualquer mês).
    /// </summary>
    private static async Task<IResult> Summary(CrmDbContext db, TimeProvider clock, string? month)
    {
        if (!TryMonth(month, clock, out var first)) return BadMonth();
        var next = first.AddMonths(1);
        var today = Today(clock);

        var paymentsReceived = await db.Payments.Where(p => p.Status == PaymentStatus.Pago && p.PaidOn >= first && p.PaidOn < next).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var ledgerReceived = await db.LedgerEntries.Where(e => e.Kind == LedgerKind.Receita && e.Status == LedgerStatus.Realizado && e.SettledOn >= first && e.SettledOn < next).SumAsync(e => (decimal?)e.Amount) ?? 0m;
        var paymentsExpected = await db.Payments.Where(p => p.Status == PaymentStatus.Pendente && p.DueDate >= first && p.DueDate < next).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var ledgerExpected = await db.LedgerEntries.Where(e => e.Kind == LedgerKind.Receita && e.Status == LedgerStatus.Previsto && e.Date >= first && e.Date < next).SumAsync(e => (decimal?)e.Amount) ?? 0m;
        var overdue = await db.Payments.Where(p => p.Status == PaymentStatus.Pendente && p.DueDate < today)
            .GroupBy(_ => 1).Select(g => new { Sum = g.Sum(p => p.Amount), Count = g.Count() }).SingleOrDefaultAsync();
        var expenses = await db.LedgerEntries.Where(e => e.Kind == LedgerKind.Despesa && e.Status == LedgerStatus.Realizado && e.SettledOn >= first && e.SettledOn < next).SumAsync(e => (decimal?)e.Amount) ?? 0m;
        var expensesPlanned = await db.LedgerEntries.Where(e => e.Kind == LedgerKind.Despesa && e.Status == LedgerStatus.Previsto && e.Date >= first && e.Date < next).SumAsync(e => (decimal?)e.Amount) ?? 0m;

        var received = paymentsReceived + ledgerReceived;
        return Results.Ok(new FinanceSummary($"{first:yyyy-MM}", received, paymentsExpected + ledgerExpected,
            overdue?.Sum ?? 0m, overdue?.Count ?? 0, expenses, expensesPlanned, received - expenses));
    }

    private static async Task<IResult> GenerateCharges(ChargeGenerator generator, TimeProvider clock, string? month, CancellationToken ct)
    {
        if (!TryMonth(month, clock, out var first)) return BadMonth();
        var created = await generator.GenerateAsync(first, ct);
        return Results.Ok(new { month = $"{first:yyyy-MM}", created });
    }
}

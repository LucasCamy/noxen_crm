using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Api.Common;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Infrastructure.Messaging;
using Noxen.Crm.Infrastructure.Persistence;
using Npgsql;

namespace Noxen.Crm.Api.Leads;

public record LeadInput
{
    [Required, MaxLength(200)] public string Company { get; init; } = "";
    [MaxLength(150)] public string? ContactName { get; init; }
    [MaxLength(30)] public string? Whatsapp { get; init; }
    [MaxLength(100)] public string? Instagram { get; init; }
    [MaxLength(100)] public string? Segment { get; init; }
    [MaxLength(100)] public string? City { get; init; }
    [StringLength(2, MinimumLength = 2)] public string? State { get; init; }
    public LeadSource Source { get; init; }
    [MaxLength(300)] public string? NextStep { get; init; }
    public DateOnly? NextStepDate { get; init; }
    [Range(0, 1_000_000_000)] public decimal? EstimatedValue { get; init; }
    public Guid? OwnerId { get; init; }
}

public sealed record UpdateLeadRequest : LeadInput
{
    /// <summary>Versão lida pelo cliente; divergência com a do banco resulta em 409.</summary>
    public uint Version { get; init; }
}

public sealed record ChangeStageRequest(LeadStage Stage, [MaxLength(300)] string? LostReason, uint Version);

public sealed record ConvertLeadRequest(
    [Range(0, 1_000_000_000)] decimal ImplementationFee,
    [Range(0, 1_000_000_000)] decimal MonthlyFee,
    [Range(1, 28)] int DueDay,
    Guid? ResponsibleId);

public sealed record LeadResponse(
    Guid Id, string Company, string? ContactName, string? Whatsapp, string? Instagram, string? Segment,
    string? City, string? State, LeadSource Source, LeadStage Stage, string? NextStep, DateOnly? NextStepDate,
    decimal? EstimatedValue, string? LostReason, Guid? OwnerId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    uint Version)
{
    public static LeadResponse From(Lead l) => new(
        l.Id, l.Company, l.ContactName, l.Whatsapp, l.Instagram, l.Segment, l.City, l.State, l.Source, l.Stage,
        l.NextStep, l.NextStepDate, l.EstimatedValue, l.LostReason, l.OwnerId, l.CreatedAt, l.UpdatedAt, l.Version);
}

public sealed record LeadStageChangeResponse(LeadStage From, LeadStage To, Guid? ChangedById, DateTimeOffset ChangedAt);

public static class LeadEndpoints
{
    public static void MapLeads(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/leads").WithTags("Leads");

        group.MapGet("/", List);
        group.MapGet("/{id:guid}", async (Guid id, CrmDbContext db) =>
            await db.Leads.AsNoTracking().SingleOrDefaultAsync(l => l.Id == id) is { } lead
                ? Results.Ok(LeadResponse.From(lead))
                : Results.NotFound());
        group.MapGet("/{id:guid}/history", async (Guid id, CrmDbContext db) =>
        {
            if (!await db.Leads.AnyAsync(l => l.Id == id)) return Results.NotFound();
            var history = await db.LeadStageChanges.AsNoTracking().Where(c => c.LeadId == id)
                .OrderBy(c => c.ChangedAt)
                .Select(c => new LeadStageChangeResponse(c.FromStage, c.ToStage, c.ChangedById, c.ChangedAt))
                .ToListAsync();
            return Results.Ok(history);
        });

        group.MapPost("/", Create).RequireAuthorization(Policies.CanWriteCrm);
        group.MapPut("/{id:guid}", Update).RequireAuthorization(Policies.CanWriteCrm);
        group.MapPost("/{id:guid}/stage", ChangeStage).RequireAuthorization(Policies.CanWriteCrm);
        group.MapPost("/{id:guid}/convert", Convert).RequireAuthorization(Policies.CanWriteCrm);
    }

    private static async Task<IResult> List(
        CrmDbContext db, LeadStage? stage, string? search, Guid? ownerId, int page = 1, int pageSize = 50)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var query = db.Leads.AsNoTracking().AsQueryable();
        if (stage is not null) query = query.Where(l => l.Stage == stage);
        if (ownerId is not null) query = query.Where(l => l.OwnerId == ownerId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = Paging.LikePattern(search);
            query = query.Where(l =>
                EF.Functions.ILike(l.Company, pattern, Paging.LikeEscape) ||
                (l.ContactName != null && EF.Functions.ILike(l.ContactName, pattern, Paging.LikeEscape)) ||
                (l.Whatsapp != null && EF.Functions.ILike(l.Whatsapp, pattern, Paging.LikeEscape)));
        }

        var total = await query.CountAsync();
        var items = await query.OrderBy(l => l.NextStepDate == null).ThenBy(l => l.NextStepDate)
            .ThenByDescending(l => l.CreatedAt).ThenBy(l => l.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Results.Ok(new PagedResult<LeadResponse>(items.Select(LeadResponse.From).ToList(), total, page, pageSize));
    }

    private static async Task<IResult> Create(LeadInput input, CrmDbContext db, TimeProvider clock, System.Security.Claims.ClaimsPrincipal user)
    {
        var now = clock.GetUtcNow();
        var lead = Lead.Create(input.Company, input.Source, input.OwnerId ?? user.GetUserId(), now);
        lead.UpdateDetails(input.Company, input.ContactName, input.Whatsapp, input.Instagram, input.Segment, input.City,
            input.State, input.Source, input.NextStep, input.NextStepDate, input.EstimatedValue, input.OwnerId ?? user.GetUserId(), now);
        db.Leads.Add(lead);
        db.AddEvent(EventTypes.LeadCreated, new LeadCreatedEvent(lead.Id), now);
        await db.SaveChangesAsync();
        return Results.Created($"/api/leads/{lead.Id}", LeadResponse.From(lead));
    }

    private static async Task<IResult> Update(Guid id, UpdateLeadRequest req, CrmDbContext db, TimeProvider clock)
    {
        var lead = await db.Leads.SingleOrDefaultAsync(l => l.Id == id);
        if (lead is null) return Results.NotFound();

        db.Entry(lead).Property(l => l.Version).OriginalValue = req.Version;
        lead.UpdateDetails(req.Company, req.ContactName, req.Whatsapp, req.Instagram, req.Segment, req.City, req.State,
            req.Source, req.NextStep, req.NextStepDate, req.EstimatedValue, req.OwnerId, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(LeadResponse.From(lead));
    }

    private static async Task<IResult> ChangeStage(
        Guid id, ChangeStageRequest req, CrmDbContext db, TimeProvider clock, System.Security.Claims.ClaimsPrincipal user)
    {
        var lead = await db.Leads.SingleOrDefaultAsync(l => l.Id == id);
        if (lead is null) return Results.NotFound();

        var now = clock.GetUtcNow();
        db.Entry(lead).Property(l => l.Version).OriginalValue = req.Version;
        var from = lead.MoveTo(req.Stage, req.LostReason, now);
        if (from != lead.Stage)
        {
            db.LeadStageChanges.Add(LeadStageChange.Create(lead.Id, from, lead.Stage, user.GetUserId(), now));
            db.AddEvent(EventTypes.LeadStageChanged, new LeadStageChangedEvent(lead.Id, from.ToString(), lead.Stage.ToString()), now);
        }
        await db.SaveChangesAsync();
        return Results.Ok(LeadResponse.From(lead));
    }

    /// <summary>
    /// Fecha o lead e cria o cliente na mesma transação. É idempotente: repetir a chamada (ou duas chamadas
    /// concorrentes) devolve o cliente já criado, garantido pelo índice único em clients.LeadId.
    /// </summary>
    private static async Task<IResult> Convert(
        Guid id, ConvertLeadRequest req, CrmDbContext db, TimeProvider clock, System.Security.Claims.ClaimsPrincipal user)
    {
        var lead = await db.Leads.SingleOrDefaultAsync(l => l.Id == id);
        if (lead is null) return Results.NotFound();

        var existing = await FindClientAsync(db, id);
        if (existing is not null) return Results.Ok(ClientResponse.From(existing));

        var now = clock.GetUtcNow();
        var (client, previous) = Client.ConvertFrom(lead, req.ImplementationFee, req.MonthlyFee, req.DueDay,
            req.ResponsibleId, DateOnly.FromDateTime(now.UtcDateTime), now);
        db.Clients.Add(client);
        db.LeadStageChanges.Add(LeadStageChange.Create(lead.Id, previous, LeadStage.Fechado, user.GetUserId(), now));
        db.AddEvent(EventTypes.LeadStageChanged, new LeadStageChangedEvent(lead.Id, previous.ToString(), nameof(LeadStage.Fechado)), now);
        db.AddEvent(EventTypes.LeadConverted, new LeadConvertedEvent(lead.Id, client.Id), now);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (Exception ex) when (ex is DbUpdateConcurrencyException || ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Outra requisição converteu o mesmo lead primeiro.
            db.ChangeTracker.Clear();
            var winner = await FindClientAsync(db, id);
            if (winner is not null) return Results.Ok(ClientResponse.From(winner));
            throw;
        }
        return Results.Created($"/api/clients/{client.Id}", ClientResponse.From(client));
    }

    private static Task<Client?> FindClientAsync(CrmDbContext db, Guid leadId) =>
        db.Clients.AsNoTracking().SingleOrDefaultAsync(c => c.LeadId == leadId);
}

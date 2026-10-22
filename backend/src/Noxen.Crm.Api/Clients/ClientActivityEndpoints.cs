using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Domain.Marketing;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Clients;

// ---------------------------------------------------------------- reuniões

public record MeetingInput
{
    public DateTimeOffset HeldAt { get; init; }
    [Required, MaxLength(200)] public string Subject { get; init; } = "";
    [MaxLength(8000)] public string? Notes { get; init; }
    [MaxLength(4000)] public string? NextSteps { get; init; }
}

public sealed record UpdateMeetingRequest : MeetingInput
{
    public uint Version { get; init; }
}

public sealed record MeetingResponse(Guid Id, Guid ClientId, DateTimeOffset HeldAt, string Subject, string? Notes, string? NextSteps, Guid? CreatedById, uint Version)
{
    public static MeetingResponse From(ClientMeeting m) => new(m.Id, m.ClientId, m.HeldAt, m.Subject, m.Notes, m.NextSteps, m.CreatedById, m.Version);
}

// ---------------------------------------------------------------- campanhas

public record CampaignInput
{
    [Required, MaxLength(200)] public string Name { get; init; } = "";
    [MaxLength(500)] public string? Objective { get; init; }
    [MaxLength(1000)] public string? Audience { get; init; }
    [MaxLength(2000)] public string? Creatives { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly? EndDate { get; init; }
    [Range(0, 1_000_000_000)] public decimal Budget { get; init; }
    public CampaignStatus Status { get; init; } = CampaignStatus.Planejada;
}

public sealed record UpdateCampaignRequest : CampaignInput
{
    public uint Version { get; init; }
}

public sealed record CampaignResponse(Guid Id, Guid ClientId, string Name, string? Objective, string? Audience, string? Creatives,
    DateOnly StartDate, DateOnly? EndDate, decimal Budget, CampaignStatus Status, uint Version)
{
    public static CampaignResponse From(Campaign c) => new(c.Id, c.ClientId, c.Name, c.Objective, c.Audience, c.Creatives, c.StartDate, c.EndDate, c.Budget, c.Status, c.Version);
}

// ---------------------------------------------------------------- resultados

public record ResultInput
{
    /// <summary>Qualquer dia do mês (é normalizado para o dia 1).</summary>
    public DateOnly Month { get; init; }
    [Range(0, 1_000_000_000)] public decimal AdSpend { get; init; }
    [Range(0, 100_000_000)] public int Leads { get; init; }
    [Range(0, 100_000_000)] public int Sales { get; init; }
    [Range(0, 1_000_000_000)] public decimal Revenue { get; init; }
    [MaxLength(2000)] public string? Notes { get; init; }
}

public sealed record UpdateResultRequest : ResultInput
{
    public uint Version { get; init; }
}

public sealed record ResultResponse(Guid Id, Guid ClientId, DateOnly Month, decimal AdSpend, int Leads, int Sales, decimal Revenue,
    decimal? CostPerLead, decimal? CostPerSale, decimal? Roas, string? Notes, uint Version)
{
    public static ResultResponse From(MonthlyResult r) => new(r.Id, r.ClientId, r.Month, r.AdSpend, r.Leads, r.Sales, r.Revenue, r.CostPerLead, r.CostPerSale, r.Roas, r.Notes, r.Version);
}

public static class ClientActivityEndpoints
{
    public static void MapClientActivities(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api").WithTags("Client activities");

        // Leitura: qualquer usuário autenticado. Escrita: Admin, Comercial e Marketing.
        g.MapGet("/clients/{clientId:guid}/meetings", async (Guid clientId, CrmDbContext db) =>
            Results.Ok((await db.ClientMeetings.AsNoTracking().Where(m => m.ClientId == clientId).OrderByDescending(m => m.HeldAt).ToListAsync()).Select(MeetingResponse.From)));
        g.MapPost("/clients/{clientId:guid}/meetings", CreateMeeting).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/meetings/{id:guid}", UpdateMeeting).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/meetings/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.ClientMeetings, id)).RequireAuthorization(Policies.CanWriteMarketing);

        g.MapGet("/clients/{clientId:guid}/campaigns", async (Guid clientId, CrmDbContext db) =>
            Results.Ok((await db.Campaigns.AsNoTracking().Where(c => c.ClientId == clientId).OrderByDescending(c => c.StartDate).ToListAsync()).Select(CampaignResponse.From)));
        g.MapPost("/clients/{clientId:guid}/campaigns", CreateCampaign).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/campaigns/{id:guid}", UpdateCampaign).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/campaigns/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.Campaigns, id)).RequireAuthorization(Policies.CanWriteMarketing);

        g.MapGet("/clients/{clientId:guid}/results", async (Guid clientId, CrmDbContext db) =>
            Results.Ok((await db.MonthlyResults.AsNoTracking().Where(r => r.ClientId == clientId).OrderByDescending(r => r.Month).ToListAsync()).Select(ResultResponse.From)));
        g.MapPost("/clients/{clientId:guid}/results", CreateResult).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/results/{id:guid}", UpdateResult).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/results/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.MonthlyResults, id)).RequireAuthorization(Policies.CanWriteMarketing);
    }

    private static Task<bool> ClientExists(CrmDbContext db, Guid clientId) => db.Clients.AnyAsync(c => c.Id == clientId);

    private static async Task<IResult> Delete<T>(CrmDbContext db, DbSet<T> set, Guid id) where T : class
    {
        var entity = await set.FindAsync(id);
        if (entity is null) return Results.NotFound();
        set.Remove(entity);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> CreateMeeting(Guid clientId, MeetingInput i, CrmDbContext db, TimeProvider clock, System.Security.Claims.ClaimsPrincipal user)
    {
        if (!await ClientExists(db, clientId)) return Results.NotFound();
        var m = ClientMeeting.Create(clientId, i.HeldAt, i.Subject, i.Notes, i.NextSteps, user.GetUserId(), clock.GetUtcNow());
        db.ClientMeetings.Add(m);
        await db.SaveChangesAsync();
        return Results.Created($"/api/meetings/{m.Id}", MeetingResponse.From(m));
    }

    private static async Task<IResult> UpdateMeeting(Guid id, UpdateMeetingRequest r, CrmDbContext db, TimeProvider clock)
    {
        var m = await db.ClientMeetings.SingleOrDefaultAsync(x => x.Id == id);
        if (m is null) return Results.NotFound();
        db.Entry(m).Property(x => x.Version).OriginalValue = r.Version;
        m.Update(r.HeldAt, r.Subject, r.Notes, r.NextSteps, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(MeetingResponse.From(m));
    }

    private static async Task<IResult> CreateCampaign(Guid clientId, CampaignInput i, CrmDbContext db, TimeProvider clock)
    {
        if (!await ClientExists(db, clientId)) return Results.NotFound();
        var c = Campaign.Create(clientId, i.Name, i.Objective, i.Audience, i.Creatives, i.StartDate, i.EndDate, i.Budget, i.Status, clock.GetUtcNow());
        db.Campaigns.Add(c);
        await db.SaveChangesAsync();
        return Results.Created($"/api/campaigns/{c.Id}", CampaignResponse.From(c));
    }

    private static async Task<IResult> UpdateCampaign(Guid id, UpdateCampaignRequest r, CrmDbContext db, TimeProvider clock)
    {
        var c = await db.Campaigns.SingleOrDefaultAsync(x => x.Id == id);
        if (c is null) return Results.NotFound();
        db.Entry(c).Property(x => x.Version).OriginalValue = r.Version;
        c.Update(r.Name, r.Objective, r.Audience, r.Creatives, r.StartDate, r.EndDate, r.Budget, r.Status, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(CampaignResponse.From(c));
    }

    private static async Task<IResult> CreateResult(Guid clientId, ResultInput i, CrmDbContext db, TimeProvider clock)
    {
        if (!await ClientExists(db, clientId)) return Results.NotFound();
        var r = MonthlyResult.Create(clientId, i.Month, i.AdSpend, i.Leads, i.Sales, i.Revenue, i.Notes, clock.GetUtcNow());
        db.MonthlyResults.Add(r);
        await db.SaveChangesAsync();
        return Results.Created($"/api/results/{r.Id}", ResultResponse.From(r));
    }

    private static async Task<IResult> UpdateResult(Guid id, UpdateResultRequest r, CrmDbContext db, TimeProvider clock)
    {
        var x = await db.MonthlyResults.SingleOrDefaultAsync(m => m.Id == id);
        if (x is null) return Results.NotFound();
        db.Entry(x).Property(m => m.Version).OriginalValue = r.Version;
        x.Update(r.AdSpend, r.Leads, r.Sales, r.Revenue, r.Notes, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ResultResponse.From(x));
    }
}

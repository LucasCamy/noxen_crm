using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Clients;

// ---------------------------------------------------------------- ficha de negócio e marketing

public record ClientProfileInput
{
    [MaxLength(300)] public string? Website { get; init; }
    [MaxLength(300)] public string? Instagram { get; init; }
    [MaxLength(300)] public string? Facebook { get; init; }
    [MaxLength(300)] public string? TikTok { get; init; }
    [MaxLength(2000)] public string? WhatTheySell { get; init; }
    [MaxLength(1000)] public string? IdealCustomer { get; init; }
    [MaxLength(2000)] public string? Differentiators { get; init; }
    [MaxLength(2000)] public string? Competitors { get; init; }
    [MaxLength(1000)] public string? Seasonality { get; init; }
    [MaxLength(500)] public string? MainGoal { get; init; }
    [MaxLength(2000)] public string? Needs { get; init; }
    [MaxLength(1000)] public string? ToneOfVoice { get; init; }
    [MaxLength(1000)] public string? ContentPillars { get; init; }
    [MaxLength(2000)] public string? WhatWorked { get; init; }
    [Range(0, 1_000_000_000)] public decimal? AdBudget { get; init; }
}

public sealed record UpdateClientProfileRequest : ClientProfileInput
{
    /// <summary>0 enquanto a ficha ainda não existe; depois, a versão lida pelo cliente.</summary>
    public uint Version { get; init; }
}

public sealed record ClientProfileResponse(
    Guid ClientId, string? Website, string? Instagram, string? Facebook, string? TikTok,
    string? WhatTheySell, string? IdealCustomer, string? Differentiators, string? Competitors, string? Seasonality,
    string? MainGoal, string? Needs, string? ToneOfVoice, string? ContentPillars, string? WhatWorked, decimal? AdBudget,
    DateTimeOffset? UpdatedAt, uint Version)
{
    public static ClientProfileResponse Empty(Guid clientId) =>
        new(clientId, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0);

    public static ClientProfileResponse From(ClientProfile p) => new(
        p.ClientId, p.Website, p.Instagram, p.Facebook, p.TikTok, p.WhatTheySell, p.IdealCustomer, p.Differentiators,
        p.Competitors, p.Seasonality, p.MainGoal, p.Needs, p.ToneOfVoice, p.ContentPillars, p.WhatWorked, p.AdBudget,
        p.UpdatedAt, p.Version);
}

// ---------------------------------------------------------------- acessos (sem senhas)

public record AccessInput
{
    [Required, MaxLength(100)] public string Platform { get; init; } = "";
    [MaxLength(200)] public string? Account { get; init; }
    [MaxLength(100)] public string? AccessType { get; init; }
    [MaxLength(200)] public string? PasswordLocation { get; init; }
    public DateOnly? GrantedOn { get; init; }
    [MaxLength(500)] public string? Note { get; init; }
}

public sealed record UpdateAccessRequest : AccessInput
{
    public uint Version { get; init; }
}

public sealed record AccessResponse(Guid Id, Guid ClientId, string Platform, string? Account, string? AccessType,
    string? PasswordLocation, DateOnly? GrantedOn, string? Note, uint Version)
{
    public static AccessResponse From(ClientAccess a) =>
        new(a.Id, a.ClientId, a.Platform, a.Account, a.AccessType, a.PasswordLocation, a.GrantedOn, a.Note, a.Version);
}

public static class ClientProfileEndpoints
{
    public static void MapClientProfiles(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api").WithTags("Client profile");

        // Leitura: qualquer usuário autenticado. Escrita: Admin, Comercial e Marketing (quem cuida do marketing do cliente).
        g.MapGet("/clients/{clientId:guid}/profile", GetProfile);
        g.MapPut("/clients/{clientId:guid}/profile", SaveProfile).RequireAuthorization(Policies.CanWriteMarketing);

        g.MapGet("/clients/{clientId:guid}/accesses", async (Guid clientId, CrmDbContext db) =>
            Results.Ok((await db.ClientAccesses.AsNoTracking().Where(a => a.ClientId == clientId).OrderBy(a => a.Platform).ThenBy(a => a.Id).ToListAsync())
                .Select(AccessResponse.From)));
        g.MapPost("/clients/{clientId:guid}/accesses", CreateAccess).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/accesses/{id:guid}", UpdateAccess).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/accesses/{id:guid}", DeleteAccess).RequireAuthorization(Policies.CanWriteMarketing);
    }

    private static async Task<IResult> GetProfile(Guid clientId, CrmDbContext db)
    {
        if (!await db.Clients.AnyAsync(c => c.Id == clientId)) return Results.NotFound();
        var profile = await db.ClientProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.ClientId == clientId);
        return Results.Ok(profile is null ? ClientProfileResponse.Empty(clientId) : ClientProfileResponse.From(profile));
    }

    /// <summary>Cria a ficha na primeira gravação e a atualiza depois, com controle de edição simultânea.</summary>
    private static async Task<IResult> SaveProfile(Guid clientId, UpdateClientProfileRequest req, CrmDbContext db, TimeProvider clock)
    {
        if (!await db.Clients.AnyAsync(c => c.Id == clientId)) return Results.NotFound();

        var now = clock.GetUtcNow();
        var profile = await db.ClientProfiles.SingleOrDefaultAsync(p => p.ClientId == clientId);
        if (profile is null)
        {
            if (req.Version != 0) return Results.Problem(statusCode: 409, title: "A ficha mudou desde a última leitura. Recarregue e tente de novo.");
            profile = ClientProfile.Create(clientId, now);
            db.ClientProfiles.Add(profile);
        }
        else
        {
            db.Entry(profile).Property(p => p.Version).OriginalValue = req.Version;
        }

        profile.Update(req.Website, req.Instagram, req.Facebook, req.TikTok, req.WhatTheySell, req.IdealCustomer,
            req.Differentiators, req.Competitors, req.Seasonality, req.MainGoal, req.Needs, req.ToneOfVoice,
            req.ContentPillars, req.WhatWorked, req.AdBudget, now);
        await db.SaveChangesAsync(); // duas primeiras gravações simultâneas: a segunda cai na chave primária e vira 409
        return Results.Ok(ClientProfileResponse.From(profile));
    }

    private static async Task<IResult> CreateAccess(Guid clientId, AccessInput i, CrmDbContext db, TimeProvider clock)
    {
        if (!await db.Clients.AnyAsync(c => c.Id == clientId)) return Results.NotFound();
        var access = ClientAccess.Create(clientId, i.Platform, i.Account, i.AccessType, i.PasswordLocation, i.GrantedOn, i.Note, clock.GetUtcNow());
        db.ClientAccesses.Add(access);
        await db.SaveChangesAsync();
        return Results.Created($"/api/accesses/{access.Id}", AccessResponse.From(access));
    }

    private static async Task<IResult> UpdateAccess(Guid id, UpdateAccessRequest i, CrmDbContext db, TimeProvider clock)
    {
        var access = await db.ClientAccesses.SingleOrDefaultAsync(a => a.Id == id);
        if (access is null) return Results.NotFound();
        db.Entry(access).Property(a => a.Version).OriginalValue = i.Version;
        access.Update(i.Platform, i.Account, i.AccessType, i.PasswordLocation, i.GrantedOn, i.Note, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(AccessResponse.From(access));
    }

    private static async Task<IResult> DeleteAccess(Guid id, CrmDbContext db)
    {
        var access = await db.ClientAccesses.SingleOrDefaultAsync(a => a.Id == id);
        if (access is null) return Results.NotFound();
        db.ClientAccesses.Remove(access);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}

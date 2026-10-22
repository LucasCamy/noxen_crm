using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Domain.Studio;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Studio;

public record ProjectInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    public Guid? ClientId { get; init; }
    public StudioKind Kind { get; init; } = StudioKind.Imagem;
    public StudioStatus Status { get; init; } = StudioStatus.Briefing;
    [MaxLength(8000)] public string? Brief { get; init; }
    [MaxLength(4000)] public string? VisualDirection { get; init; }
    [MaxLength(8000)] public string? Storyboard { get; init; }
    [MaxLength(4000)] public string? Deliverables { get; init; }
    public DateOnly? DueDate { get; init; }
}

public sealed record UpdateProjectRequest : ProjectInput
{
    public uint Version { get; init; }
}

public sealed record ProjectResponse(Guid Id, string Title, Guid? ClientId, string? ClientName, StudioKind Kind, StudioStatus Status, string? Brief,
    string? VisualDirection, string? Storyboard, string? Deliverables, DateOnly? DueDate, uint Version);

public record KitInput
{
    public Guid? ClientId { get; init; }
    [Required, MaxLength(200)] public string Name { get; init; } = "";
    /// <summary>Cores #RRGGBB separadas por vírgula, espaço ou quebra de linha.</summary>
    [MaxLength(200)] public string? Colors { get; init; }
    [MaxLength(500)] public string? Fonts { get; init; }
    [MaxLength(2000)] public string? Tone { get; init; }
    [MaxLength(2000)] public string? Elements { get; init; }
    [MaxLength(1000)] public string? LogoUrl { get; init; }
}

public sealed record UpdateKitRequest : KitInput
{
    public uint Version { get; init; }
}

public sealed record KitResponse(Guid Id, Guid? ClientId, string? ClientName, string Name, IReadOnlyList<string> Colors, string? Fonts, string? Tone,
    string? Elements, string? LogoUrl, uint Version);

public record ReferenceInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    [Required, MaxLength(1000)] public string Url { get; init; } = "";
    [MaxLength(300)] public string? Tags { get; init; }
    [MaxLength(2000)] public string? Note { get; init; }
    public Guid? ClientId { get; init; }
}

public sealed record UpdateReferenceRequest : ReferenceInput
{
    public uint Version { get; init; }
}

public sealed record ReferenceResponse(Guid Id, string Title, string Url, string? Tags, string? Note, Guid? ClientId, string? ClientName, uint Version);

public static class StudioEndpoints
{
    private const int MaxList = 500;

    public static void MapStudio(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/studio").WithTags("Studio");

        g.MapGet("/projects", async (CrmDbContext db, StudioStatus? status, Guid? clientId) =>
        {
            var q = db.StudioProjects.AsNoTracking().AsQueryable();
            if (status is not null) q = q.Where(p => p.Status == status);
            if (clientId is not null) q = q.Where(p => p.ClientId == clientId);
            var items = await q.OrderBy(p => p.DueDate == null).ThenBy(p => p.DueDate).ThenByDescending(p => p.CreatedAt).Take(MaxList).ToListAsync();
            var names = await ClientNames(db, items.Select(p => p.ClientId));
            return Results.Ok(items.Select(p => ToResponse(p, Name(names, p.ClientId))));
        });
        g.MapPost("/projects", CreateProject).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/projects/{id:guid}", UpdateProject).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/projects/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.StudioProjects, id)).RequireAuthorization(Policies.CanWriteMarketing);

        g.MapGet("/kits", async (CrmDbContext db) =>
        {
            var items = await db.BrandKits.AsNoTracking().OrderBy(k => k.Name).Take(MaxList).ToListAsync();
            var names = await ClientNames(db, items.Select(k => k.ClientId));
            return Results.Ok(items.Select(k => ToResponse(k, Name(names, k.ClientId))));
        });
        g.MapPost("/kits", CreateKit).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/kits/{id:guid}", UpdateKit).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/kits/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.BrandKits, id)).RequireAuthorization(Policies.CanWriteMarketing);

        g.MapGet("/references", async (CrmDbContext db, string? tag) =>
        {
            var q = db.ReferenceLinks.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(tag)) q = q.Where(r => r.Tags != null && EF.Functions.ILike(r.Tags, $"%{tag.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%", "\\"));
            var items = await q.OrderByDescending(r => r.CreatedAt).Take(MaxList).ToListAsync();
            var names = await ClientNames(db, items.Select(r => r.ClientId));
            return Results.Ok(items.Select(r => ToResponse(r, Name(names, r.ClientId))));
        });
        g.MapPost("/references", CreateReference).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/references/{id:guid}", UpdateReference).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/references/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.ReferenceLinks, id)).RequireAuthorization(Policies.CanWriteMarketing);
    }

    private static async Task<IResult> Delete<T>(CrmDbContext db, DbSet<T> set, Guid id) where T : class
    {
        var entity = await set.FindAsync(id);
        if (entity is null) return Results.NotFound();
        set.Remove(entity);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<Dictionary<Guid, string>> ClientNames(CrmDbContext db, IEnumerable<Guid?> ids)
    {
        var wanted = ids.Where(i => i is not null).Select(i => i!.Value).Distinct().ToList();
        return wanted.Count == 0 ? [] : await db.Clients.AsNoTracking().Where(c => wanted.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name);
    }

    private static string? Name(Dictionary<Guid, string> names, Guid? id) => id is { } v ? names.GetValueOrDefault(v) : null;

    private static async Task<IResult> CheckClient(CrmDbContext db, Guid? clientId) =>
        clientId is not null && !await db.Clients.AnyAsync(c => c.Id == clientId) ? Results.Problem(statusCode: 422, title: "Cliente não encontrado.") : Results.Empty;

    // ---- projetos

    private static ProjectResponse ToResponse(StudioProject p, string? clientName) => new(p.Id, p.Title, p.ClientId, clientName, p.Kind, p.Status, p.Brief,
        p.VisualDirection, p.Storyboard, p.Deliverables, p.DueDate, p.Version);

    private static async Task<IResult> CreateProject(ProjectInput i, CrmDbContext db, TimeProvider clock)
    {
        var bad = await CheckClient(db, i.ClientId);
        if (bad != Results.Empty) return bad;
        var p = StudioProject.Create(i.Title, i.ClientId, i.Kind, i.Status, i.Brief, i.VisualDirection, i.Storyboard, i.Deliverables, i.DueDate, clock.GetUtcNow());
        db.StudioProjects.Add(p);
        await db.SaveChangesAsync();
        return Results.Created($"/api/studio/projects/{p.Id}", ToResponse(p, Name(await ClientNames(db, [p.ClientId]), p.ClientId)));
    }

    private static async Task<IResult> UpdateProject(Guid id, UpdateProjectRequest r, CrmDbContext db, TimeProvider clock)
    {
        var p = await db.StudioProjects.SingleOrDefaultAsync(x => x.Id == id);
        if (p is null) return Results.NotFound();
        var bad = await CheckClient(db, r.ClientId);
        if (bad != Results.Empty) return bad;
        db.Entry(p).Property(x => x.Version).OriginalValue = r.Version;
        p.Update(r.Title, r.ClientId, r.Kind, r.Status, r.Brief, r.VisualDirection, r.Storyboard, r.Deliverables, r.DueDate, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(p, Name(await ClientNames(db, [p.ClientId]), p.ClientId)));
    }

    // ---- kits

    private static KitResponse ToResponse(BrandKit k, string? clientName) => new(k.Id, k.ClientId, clientName, k.Name, k.ColorList, k.Fonts, k.Tone, k.Elements, k.LogoUrl, k.Version);

    private static async Task<IResult> CreateKit(KitInput i, CrmDbContext db, TimeProvider clock)
    {
        var bad = await CheckClient(db, i.ClientId);
        if (bad != Results.Empty) return bad;
        var k = BrandKit.Create(i.ClientId, i.Name, i.Colors, i.Fonts, i.Tone, i.Elements, i.LogoUrl, clock.GetUtcNow());
        db.BrandKits.Add(k);
        await db.SaveChangesAsync();
        return Results.Created($"/api/studio/kits/{k.Id}", ToResponse(k, Name(await ClientNames(db, [k.ClientId]), k.ClientId)));
    }

    private static async Task<IResult> UpdateKit(Guid id, UpdateKitRequest r, CrmDbContext db, TimeProvider clock)
    {
        var k = await db.BrandKits.SingleOrDefaultAsync(x => x.Id == id);
        if (k is null) return Results.NotFound();
        var bad = await CheckClient(db, r.ClientId);
        if (bad != Results.Empty) return bad;
        db.Entry(k).Property(x => x.Version).OriginalValue = r.Version;
        k.Update(r.ClientId, r.Name, r.Colors, r.Fonts, r.Tone, r.Elements, r.LogoUrl, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(k, Name(await ClientNames(db, [k.ClientId]), k.ClientId)));
    }

    // ---- referências

    private static ReferenceResponse ToResponse(ReferenceLink r, string? clientName) => new(r.Id, r.Title, r.Url, r.Tags, r.Note, r.ClientId, clientName, r.Version);

    private static async Task<IResult> CreateReference(ReferenceInput i, CrmDbContext db, TimeProvider clock)
    {
        var bad = await CheckClient(db, i.ClientId);
        if (bad != Results.Empty) return bad;
        var r = ReferenceLink.Create(i.Title, i.Url, i.Tags, i.Note, i.ClientId, clock.GetUtcNow());
        db.ReferenceLinks.Add(r);
        await db.SaveChangesAsync();
        return Results.Created($"/api/studio/references/{r.Id}", ToResponse(r, Name(await ClientNames(db, [r.ClientId]), r.ClientId)));
    }

    private static async Task<IResult> UpdateReference(Guid id, UpdateReferenceRequest r, CrmDbContext db, TimeProvider clock)
    {
        var x = await db.ReferenceLinks.SingleOrDefaultAsync(l => l.Id == id);
        if (x is null) return Results.NotFound();
        var bad = await CheckClient(db, r.ClientId);
        if (bad != Results.Empty) return bad;
        db.Entry(x).Property(l => l.Version).OriginalValue = r.Version;
        x.Update(r.Title, r.Url, r.Tags, r.Note, r.ClientId, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(x, Name(await ClientNames(db, [x.ClientId]), x.ClientId)));
    }
}

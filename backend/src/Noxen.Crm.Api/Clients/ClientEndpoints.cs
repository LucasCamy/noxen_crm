using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Api.Common;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Infrastructure.Messaging;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Clients;

public record ClientInput
{
    [Required, MaxLength(200)] public string Name { get; init; } = "";
    [MaxLength(200)] public string? LegalName { get; init; }
    [MaxLength(18)] public string? Cnpj { get; init; }
    [MaxLength(100)] public string? Segment { get; init; }
    [MaxLength(100)] public string? City { get; init; }
    [StringLength(2, MinimumLength = 2)] public string? State { get; init; }
    [MaxLength(150)] public string? ContactName { get; init; }
    [MaxLength(30)] public string? ContactWhatsapp { get; init; }
    [Range(0, 1_000_000_000)] public decimal ImplementationFee { get; init; }
    [Range(0, 1_000_000_000)] public decimal MonthlyFee { get; init; }
    [Range(1, 28)] public int DueDay { get; init; } = 10;
    public DateTimeOffset? NextMeeting { get; init; }
    public Guid? ResponsibleId { get; init; }
    [MaxLength(4000)] public string? Notes { get; init; }
    [MaxLength(200)] public string? ContactEmail { get; init; }
    [MaxLength(2000)] public string? ContractedServices { get; init; }
    [MaxLength(100)] public string? PaymentMethod { get; init; }
    public DateOnly? ContractStart { get; init; }
    public DateOnly? ContractEnd { get; init; }
    [MaxLength(300)] public string? Readjustment { get; init; }
}

public sealed record UpdateClientRequest : ClientInput
{
    public uint Version { get; init; }
}

public sealed record ChangeClientStatusRequest(ClientStatus Status, uint Version);

public sealed record ClientResponse(
    Guid Id, Guid? LeadId, string Name, string? LegalName, string? Cnpj, string? Segment, string? City, string? State,
    string? ContactName, string? ContactWhatsapp, ClientStatus Status, decimal ImplementationFee, decimal MonthlyFee,
    int DueDay, DateOnly ClientSince, DateTimeOffset? NextMeeting, Guid? ResponsibleId, string? Notes,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, uint Version,
    string? ContactEmail = null, string? ContractedServices = null, string? PaymentMethod = null,
    DateOnly? ContractStart = null, DateOnly? ContractEnd = null, string? Readjustment = null)
{
    public static ClientResponse From(Client c) => new(
        c.Id, c.LeadId, c.Name, c.LegalName, c.Cnpj, c.Segment, c.City, c.State, c.ContactName, c.ContactWhatsapp,
        c.Status, c.ImplementationFee, c.MonthlyFee, c.DueDay, c.ClientSince, c.NextMeeting, c.ResponsibleId, c.Notes,
        c.CreatedAt, c.UpdatedAt, c.Version, c.ContactEmail, c.ContractedServices, c.PaymentMethod, c.ContractStart, c.ContractEnd, c.Readjustment);
}

public static class ClientEndpoints
{
    public static void MapClients(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/clients").WithTags("Clients");

        group.MapGet("/", List);
        group.MapGet("/{id:guid}", async (Guid id, CrmDbContext db) =>
            await db.Clients.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id) is { } client
                ? Results.Ok(ClientResponse.From(client))
                : Results.NotFound());

        group.MapPost("/", Create).RequireAuthorization(Policies.CanWriteCrm);
        group.MapPut("/{id:guid}", Update).RequireAuthorization(Policies.CanWriteCrm);
        group.MapPost("/{id:guid}/status", ChangeStatus).RequireAuthorization(Policies.CanWriteCrm);
    }

    private static async Task<IResult> List(CrmDbContext db, ClientStatus? status, string? search, int page = 1, int pageSize = 50)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var query = db.Clients.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(c => c.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = Paging.LikePattern(search);
            query = query.Where(c => EF.Functions.ILike(c.Name, pattern, Paging.LikeEscape) ||
                                     (c.LegalName != null && EF.Functions.ILike(c.LegalName, pattern, Paging.LikeEscape)));
        }

        var total = await query.CountAsync();
        var items = await query.OrderBy(c => c.Name).ThenBy(c => c.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Results.Ok(new PagedResult<ClientResponse>(items.Select(ClientResponse.From).ToList(), total, page, pageSize));
    }

    private static async Task<IResult> Create(ClientInput input, CrmDbContext db, TimeProvider clock)
    {
        var now = clock.GetUtcNow();
        var client = Client.Create(input.Name, input.ImplementationFee, input.MonthlyFee, input.DueDay,
            DateOnly.FromDateTime(now.UtcDateTime), input.ResponsibleId, now);
        Apply(client, input, now);
        db.Clients.Add(client);
        db.AddEvent(EventTypes.ClientChanged, new ClientChangedEvent(client.Id, "created"), now);
        await db.SaveChangesAsync();
        return Results.Created($"/api/clients/{client.Id}", ClientResponse.From(client));
    }

    private static async Task<IResult> Update(Guid id, UpdateClientRequest req, CrmDbContext db, TimeProvider clock)
    {
        var client = await db.Clients.SingleOrDefaultAsync(c => c.Id == id);
        if (client is null) return Results.NotFound();

        var now = clock.GetUtcNow();
        db.Entry(client).Property(c => c.Version).OriginalValue = req.Version;
        Apply(client, req, now);
        db.AddEvent(EventTypes.ClientChanged, new ClientChangedEvent(client.Id, "updated"), now);
        await db.SaveChangesAsync();
        return Results.Ok(ClientResponse.From(client));
    }

    private static async Task<IResult> ChangeStatus(Guid id, ChangeClientStatusRequest req, CrmDbContext db, TimeProvider clock)
    {
        var client = await db.Clients.SingleOrDefaultAsync(c => c.Id == id);
        if (client is null) return Results.NotFound();

        var now = clock.GetUtcNow();
        db.Entry(client).Property(c => c.Version).OriginalValue = req.Version;
        var from = client.ChangeStatus(req.Status, now);
        if (from != client.Status)
            db.AddEvent(EventTypes.ClientChanged, new ClientChangedEvent(client.Id, $"status:{from}->{client.Status}"), now);
        await db.SaveChangesAsync();
        return Results.Ok(ClientResponse.From(client));
    }

    private static void Apply(Client client, ClientInput i, DateTimeOffset now)
    {
        client.UpdateDetails(i.Name, i.LegalName, i.Cnpj, i.Segment, i.City, i.State, i.ContactName, i.ContactWhatsapp,
            i.ImplementationFee, i.MonthlyFee, i.DueDay, i.NextMeeting, i.ResponsibleId, i.Notes, now);
        client.UpdateContract(i.ContactEmail, i.ContractedServices, i.PaymentMethod, i.ContractStart, i.ContractEnd, i.Readjustment, now);
    }
}

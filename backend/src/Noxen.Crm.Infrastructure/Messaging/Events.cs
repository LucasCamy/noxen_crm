using System.Text.Json;
using Noxen.Crm.Domain.Outbox;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Infrastructure.Messaging;

/// <summary>Chaves de roteamento dos eventos publicados no exchange noxen.crm.events.</summary>
public static class EventTypes
{
    public const string LeadCreated = "lead.created";
    public const string LeadStageChanged = "lead.stage-changed";
    public const string LeadConverted = "lead.converted";
    public const string ClientChanged = "client.changed";
}

public sealed record LeadCreatedEvent(Guid LeadId);
public sealed record LeadStageChangedEvent(Guid LeadId, string From, string To);
public sealed record LeadConvertedEvent(Guid LeadId, Guid ClientId);
public sealed record ClientChangedEvent(Guid ClientId, string Reason);

public static class OutboxExtensions
{
    /// <summary>Registra o evento no contexto; é persistido junto com a mudança no mesmo SaveChanges.</summary>
    public static void AddEvent<T>(this CrmDbContext db, string type, T payload, DateTimeOffset now) =>
        db.OutboxMessages.Add(OutboxMessage.Create(type, JsonSerializer.Serialize(payload), now));
}

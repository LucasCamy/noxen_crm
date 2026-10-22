namespace Noxen.Crm.Domain.Outbox;

/// <summary>
/// Evento de domínio gravado na mesma transação da mudança; o worker o publica no RabbitMQ
/// (transactional outbox), garantindo entrega pelo menos uma vez.
/// </summary>
public sealed class OutboxMessage
{
    private OutboxMessage() { }

    public Guid Id { get; private set; }
    /// <summary>Chave de roteamento, ex.: "lead.stage-changed".</summary>
    public string Type { get; private set; } = "";
    public string Payload { get; private set; } = "{}";
    public DateTimeOffset OccurredAt { get; private set; }
    public DateTimeOffset? ProcessedAt { get; private set; }
    public int Attempts { get; private set; }
    public string? LastError { get; private set; }

    public static OutboxMessage Create(string type, string payload, DateTimeOffset now) =>
        new() { Id = Guid.NewGuid(), Type = type, Payload = payload, OccurredAt = now };

    public void MarkProcessed(DateTimeOffset now)
    {
        ProcessedAt = now;
        LastError = null;
    }

    public void MarkFailed(string error)
    {
        Attempts++;
        LastError = error.Length > 500 ? error[..500] : error;
    }
}

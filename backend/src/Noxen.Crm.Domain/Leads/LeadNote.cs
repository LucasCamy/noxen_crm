namespace Noxen.Crm.Domain.Leads;

/// <summary>Anotação livre no histórico do lead (o que foi dito, combinado ou percebido). Imutável: para corrigir, apague e escreva outra.</summary>
public sealed class LeadNote
{
    public const int MaxLength = 2000;

    private LeadNote() { }

    public Guid Id { get; private set; }
    public Guid LeadId { get; private set; }
    public string Text { get; private set; } = "";
    public Guid? CreatedById { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public static LeadNote Create(Guid leadId, string text, Guid? createdById, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(text)) throw new DomainException("Escreva a anotação.");
        var trimmed = text.Trim();
        if (trimmed.Length > MaxLength) throw new DomainException($"A anotação pode ter até {MaxLength} caracteres.");
        return new LeadNote { Id = Guid.NewGuid(), LeadId = leadId, Text = trimmed, CreatedById = createdById, CreatedAt = now };
    }
}

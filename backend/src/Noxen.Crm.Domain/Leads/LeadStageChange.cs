namespace Noxen.Crm.Domain.Leads;

/// <summary>Histórico imutável de movimentações do lead no funil.</summary>
public sealed class LeadStageChange
{
    private LeadStageChange() { }

    public Guid Id { get; private set; }
    public Guid LeadId { get; private set; }
    public LeadStage FromStage { get; private set; }
    public LeadStage ToStage { get; private set; }
    public Guid? ChangedById { get; private set; }
    public DateTimeOffset ChangedAt { get; private set; }

    public static LeadStageChange Create(Guid leadId, LeadStage from, LeadStage to, Guid? changedById, DateTimeOffset at) =>
        new() { Id = Guid.NewGuid(), LeadId = leadId, FromStage = from, ToStage = to, ChangedById = changedById, ChangedAt = at };
}

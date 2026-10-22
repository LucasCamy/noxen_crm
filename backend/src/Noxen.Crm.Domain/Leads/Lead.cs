namespace Noxen.Crm.Domain.Leads;

public sealed class Lead
{
    private Lead() { }

    public Guid Id { get; private set; }
    public string Company { get; private set; } = "";
    public string? ContactName { get; private set; }
    public string? Whatsapp { get; private set; }
    public string? Instagram { get; private set; }
    public string? Segment { get; private set; }
    public string? City { get; private set; }
    public string? State { get; private set; }
    public LeadSource Source { get; private set; }
    public LeadStage Stage { get; private set; }
    public string? NextStep { get; private set; }
    public DateOnly? NextStepDate { get; private set; }
    public decimal? EstimatedValue { get; private set; }
    public string? LostReason { get; private set; }
    public Guid? OwnerId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>Token de concorrência otimista (coluna de sistema xmin do PostgreSQL).</summary>
    public uint Version { get; private set; }

    public static Lead Create(string company, LeadSource source, Guid? ownerId, DateTimeOffset now)
    {
        var lead = new Lead
        {
            Id = Guid.NewGuid(),
            Source = source,
            Stage = LeadStage.AContatar,
            OwnerId = ownerId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        lead.SetCompany(company);
        return lead;
    }

    public void UpdateDetails(
        string company, string? contactName, string? whatsapp, string? instagram, string? segment,
        string? city, string? state, LeadSource source, string? nextStep, DateOnly? nextStepDate,
        decimal? estimatedValue, Guid? ownerId, DateTimeOffset now)
    {
        if (estimatedValue is < 0) throw new DomainException("O valor estimado não pode ser negativo.");
        if (state is { Length: not 2 }) throw new DomainException("A UF deve ter 2 letras.");

        SetCompany(company);
        ContactName = Clean(contactName);
        Whatsapp = Clean(whatsapp);
        Instagram = Clean(instagram);
        Segment = Clean(segment);
        City = Clean(city);
        State = Clean(state)?.ToUpperInvariant();
        Source = source;
        NextStep = Clean(nextStep);
        NextStepDate = nextStepDate;
        EstimatedValue = estimatedValue;
        OwnerId = ownerId;
        UpdatedAt = now;
    }

    /// <summary>
    /// Move o lead no funil. Fechado só é alcançado pela conversão em cliente; Perdido exige motivo;
    /// Fechado é terminal e um lead Perdido só pode ser reaberto como "A contatar".
    /// </summary>
    public LeadStage MoveTo(LeadStage target, string? lostReason, DateTimeOffset now)
    {
        if (!Enum.IsDefined(target)) throw new DomainException("Etapa inválida.");
        if (target == LeadStage.Fechado)
            throw new DomainException("Um lead só vira Fechado ao ser convertido em cliente.");
        if (Stage == LeadStage.Fechado)
            throw new DomainException("Um lead fechado não pode mudar de etapa.");
        if (Stage == LeadStage.Perdido && target != LeadStage.AContatar)
            throw new DomainException("Um lead perdido só pode ser reaberto como \"A contatar\".");
        if (target == LeadStage.Perdido && string.IsNullOrWhiteSpace(lostReason))
            throw new DomainException("Informe o motivo da perda.");

        var from = Stage;
        Stage = target;
        LostReason = target == LeadStage.Perdido ? lostReason!.Trim() : null;
        UpdatedAt = now;
        return from;
    }

    internal LeadStage MarkClosed(DateTimeOffset now)
    {
        if (Stage == LeadStage.Fechado) throw new DomainException("O lead já foi convertido.");
        if (Stage == LeadStage.Perdido)
            throw new DomainException("Reabra o lead perdido antes de convertê-lo em cliente.");
        var from = Stage;
        Stage = LeadStage.Fechado;
        LostReason = null;
        UpdatedAt = now;
        return from;
    }

    private void SetCompany(string company)
    {
        if (string.IsNullOrWhiteSpace(company)) throw new DomainException("Informe o nome da empresa.");
        Company = company.Trim();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

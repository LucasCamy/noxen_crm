namespace Noxen.Crm.Domain.Marketing;

/// <summary>Reunião registrada com um cliente.</summary>
public sealed class ClientMeeting
{
    private ClientMeeting() { }

    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public DateTimeOffset HeldAt { get; private set; }
    public string Subject { get; private set; } = "";
    public string? Notes { get; private set; }
    public string? NextSteps { get; private set; }
    public Guid? CreatedById { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static ClientMeeting Create(Guid clientId, DateTimeOffset heldAt, string subject, string? notes, string? nextSteps,
        Guid? createdById, DateTimeOffset now)
    {
        var m = new ClientMeeting { Id = Guid.NewGuid(), ClientId = clientId, CreatedById = createdById, CreatedAt = now, UpdatedAt = now };
        m.Apply(heldAt, subject, notes, nextSteps);
        return m;
    }

    public void Update(DateTimeOffset heldAt, string subject, string? notes, string? nextSteps, DateTimeOffset now)
    {
        Apply(heldAt, subject, notes, nextSteps);
        UpdatedAt = now;
    }

    private void Apply(DateTimeOffset heldAt, string subject, string? notes, string? nextSteps)
    {
        if (string.IsNullOrWhiteSpace(subject)) throw new DomainException("Informe o assunto da reunião.");
        HeldAt = heldAt;
        Subject = subject.Trim();
        Notes = Clean(notes);
        NextSteps = Clean(nextSteps);
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

public enum CampaignStatus
{
    Planejada = 0,
    Ativa = 1,
    Pausada = 2,
    Encerrada = 3,
}

/// <summary>Campanha de anúncios de um cliente.</summary>
public sealed class Campaign
{
    private Campaign() { }

    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public string Name { get; private set; } = "";
    public string? Objective { get; private set; }
    public string? Audience { get; private set; }
    public string? Creatives { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public decimal Budget { get; private set; }
    public CampaignStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static Campaign Create(Guid clientId, string name, string? objective, string? audience, string? creatives,
        DateOnly startDate, DateOnly? endDate, decimal budget, CampaignStatus status, DateTimeOffset now)
    {
        var c = new Campaign { Id = Guid.NewGuid(), ClientId = clientId, CreatedAt = now, UpdatedAt = now };
        c.Apply(name, objective, audience, creatives, startDate, endDate, budget, status);
        return c;
    }

    public void Update(string name, string? objective, string? audience, string? creatives, DateOnly startDate,
        DateOnly? endDate, decimal budget, CampaignStatus status, DateTimeOffset now)
    {
        Apply(name, objective, audience, creatives, startDate, endDate, budget, status);
        UpdatedAt = now;
    }

    private void Apply(string name, string? objective, string? audience, string? creatives, DateOnly startDate,
        DateOnly? endDate, decimal budget, CampaignStatus status)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new DomainException("Informe o nome da campanha.");
        if (budget < 0) throw new DomainException("A verba não pode ser negativa.");
        if (endDate is not null && endDate < startDate) throw new DomainException("O fim da campanha não pode ser antes do início.");
        if (!Enum.IsDefined(status)) throw new DomainException("Status inválido.");
        Name = name.Trim();
        Objective = Clean(objective);
        Audience = Clean(audience);
        Creatives = Clean(creatives);
        StartDate = startDate;
        EndDate = endDate;
        Budget = decimal.Round(budget, 2);
        Status = status;
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

/// <summary>Resultado mensal de marketing de um cliente. CPL, CAC e ROAS são derivados.</summary>
public sealed class MonthlyResult
{
    private MonthlyResult() { }

    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    /// <summary>Sempre o dia 1 do mês.</summary>
    public DateOnly Month { get; private set; }
    public decimal AdSpend { get; private set; }
    public int Leads { get; private set; }
    public int Sales { get; private set; }
    public decimal Revenue { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public decimal? CostPerLead => Leads > 0 ? decimal.Round(AdSpend / Leads, 2) : null;
    public decimal? CostPerSale => Sales > 0 ? decimal.Round(AdSpend / Sales, 2) : null;
    public decimal? Roas => AdSpend > 0 ? decimal.Round(Revenue / AdSpend, 2) : null;

    public static MonthlyResult Create(Guid clientId, DateOnly month, decimal adSpend, int leads, int sales, decimal revenue,
        string? notes, DateTimeOffset now)
    {
        var r = new MonthlyResult { Id = Guid.NewGuid(), ClientId = clientId, Month = new DateOnly(month.Year, month.Month, 1), CreatedAt = now, UpdatedAt = now };
        r.Apply(adSpend, leads, sales, revenue, notes);
        return r;
    }

    public void Update(decimal adSpend, int leads, int sales, decimal revenue, string? notes, DateTimeOffset now)
    {
        Apply(adSpend, leads, sales, revenue, notes);
        UpdatedAt = now;
    }

    private void Apply(decimal adSpend, int leads, int sales, decimal revenue, string? notes)
    {
        if (adSpend < 0 || revenue < 0) throw new DomainException("Valores não podem ser negativos.");
        if (leads < 0 || sales < 0) throw new DomainException("Quantidades não podem ser negativas.");
        AdSpend = decimal.Round(adSpend, 2);
        Leads = leads;
        Sales = sales;
        Revenue = decimal.Round(revenue, 2);
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }
}

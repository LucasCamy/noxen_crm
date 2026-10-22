namespace Noxen.Crm.Domain.Finance;

public enum LedgerKind
{
    Receita = 0,
    Despesa = 1,
}

public enum LedgerStatus
{
    Previsto = 0,
    Realizado = 1,
    Cancelado = 2,
}

/// <summary>Receita avulsa ou despesa da agência (as mensalidades dos clientes ficam em <see cref="Payment"/>).</summary>
public sealed class LedgerEntry
{
    private LedgerEntry() { }

    public Guid Id { get; private set; }
    public LedgerKind Kind { get; private set; }
    public DateOnly Date { get; private set; }
    public string Description { get; private set; } = "";
    public string? Category { get; private set; }
    public decimal Amount { get; private set; }
    public Guid? ClientId { get; private set; }
    public LedgerStatus Status { get; private set; }
    public DateOnly? SettledOn { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static LedgerEntry Create(LedgerKind kind, DateOnly date, string description, string? category, decimal amount,
        Guid? clientId, DateTimeOffset now)
    {
        if (!Enum.IsDefined(kind)) throw new DomainException("Tipo de lançamento inválido.");
        var e = new LedgerEntry { Id = Guid.NewGuid(), Kind = kind, Status = LedgerStatus.Previsto, CreatedAt = now, UpdatedAt = now };
        e.Apply(date, description, category, amount, clientId);
        return e;
    }

    public void Update(DateOnly date, string description, string? category, decimal amount, Guid? clientId, DateTimeOffset now)
    {
        if (Status == LedgerStatus.Cancelado) throw new DomainException("Um lançamento cancelado não pode ser editado.");
        Apply(date, description, category, amount, clientId);
        UpdatedAt = now;
    }

    public void Settle(DateOnly settledOn, DateOnly today, DateTimeOffset now)
    {
        if (Status == LedgerStatus.Cancelado) throw new DomainException("Um lançamento cancelado não pode ser baixado.");
        if (Status == LedgerStatus.Realizado) throw new DomainException("Este lançamento já foi realizado.");
        if (settledOn > today) throw new DomainException("A data de realização não pode ser futura.");
        SettledOn = settledOn;
        Status = LedgerStatus.Realizado;
        UpdatedAt = now;
    }

    public void Cancel(DateTimeOffset now)
    {
        if (Status == LedgerStatus.Realizado) throw new DomainException("Um lançamento realizado não pode ser cancelado.");
        if (Status == LedgerStatus.Cancelado) throw new DomainException("Este lançamento já está cancelado.");
        Status = LedgerStatus.Cancelado;
        UpdatedAt = now;
    }

    public bool IsOverdue(DateOnly today) => Status == LedgerStatus.Previsto && Date < today;

    private void Apply(DateOnly date, string description, string? category, decimal amount, Guid? clientId)
    {
        if (string.IsNullOrWhiteSpace(description)) throw new DomainException("Informe a descrição.");
        if (amount <= 0) throw new DomainException("O valor deve ser maior que zero.");
        Date = date;
        Description = description.Trim();
        Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim();
        Amount = decimal.Round(amount, 2);
        ClientId = clientId;
    }
}

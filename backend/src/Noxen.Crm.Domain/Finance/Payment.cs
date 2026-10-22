namespace Noxen.Crm.Domain.Finance;

public enum PaymentKind
{
    Mensalidade = 0,
    Implementacao = 1,
    Avulso = 2,
}

public enum PaymentStatus
{
    Pendente = 0,
    Pago = 1,
    Cancelado = 2,
}

/// <summary>Cobrança de um cliente (mensalidade, implementação ou avulsa). "Atrasado" é derivado: pendente e vencida.</summary>
public sealed class Payment
{
    private Payment() { }

    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public PaymentKind Kind { get; private set; }
    /// <summary>Sempre o dia 1 do mês de referência.</summary>
    public DateOnly ReferenceMonth { get; private set; }
    public string? Description { get; private set; }
    public decimal Amount { get; private set; }
    public DateOnly DueDate { get; private set; }
    public DateOnly? PaidOn { get; private set; }
    public PaymentStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static Payment Create(Guid clientId, PaymentKind kind, DateOnly referenceMonth, decimal amount, DateOnly dueDate,
        string? description, DateTimeOffset now)
    {
        if (!Enum.IsDefined(kind)) throw new DomainException("Tipo de cobrança inválido.");
        var p = new Payment
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            Kind = kind,
            ReferenceMonth = new DateOnly(referenceMonth.Year, referenceMonth.Month, 1),
            Status = PaymentStatus.Pendente,
            CreatedAt = now,
            UpdatedAt = now,
        };
        p.Apply(amount, dueDate, description);
        return p;
    }

    public void UpdateDetails(decimal amount, DateOnly dueDate, string? description, DateTimeOffset now)
    {
        if (Status != PaymentStatus.Pendente) throw new DomainException("Só cobranças pendentes podem ser editadas.");
        Apply(amount, dueDate, description);
        UpdatedAt = now;
    }

    public void MarkPaid(DateOnly paidOn, DateOnly today, DateTimeOffset now)
    {
        if (Status == PaymentStatus.Cancelado) throw new DomainException("Uma cobrança cancelada não pode ser paga.");
        if (Status == PaymentStatus.Pago) throw new DomainException("Esta cobrança já foi paga.");
        if (paidOn > today) throw new DomainException("A data do pagamento não pode ser futura.");
        PaidOn = paidOn;
        Status = PaymentStatus.Pago;
        UpdatedAt = now;
    }

    public void Cancel(DateTimeOffset now)
    {
        if (Status == PaymentStatus.Pago) throw new DomainException("Uma cobrança já paga não pode ser cancelada.");
        if (Status == PaymentStatus.Cancelado) throw new DomainException("Esta cobrança já está cancelada.");
        Status = PaymentStatus.Cancelado;
        UpdatedAt = now;
    }

    public bool IsOverdue(DateOnly today) => Status == PaymentStatus.Pendente && DueDate < today;

    private void Apply(decimal amount, DateOnly dueDate, string? description)
    {
        if (amount <= 0) throw new DomainException("O valor da cobrança deve ser maior que zero.");
        Amount = decimal.Round(amount, 2);
        DueDate = dueDate;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }
}

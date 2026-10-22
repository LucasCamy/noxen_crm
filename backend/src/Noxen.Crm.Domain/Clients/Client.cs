using Noxen.Crm.Domain.Leads;

namespace Noxen.Crm.Domain.Clients;

public enum ClientStatus
{
    Implementacao = 0,
    Ativo = 1,
    Pausado = 2,
    Encerrado = 3,
}

public sealed class Client
{
    private Client() { }

    public Guid Id { get; private set; }
    /// <summary>Lead que originou o cliente; único, o que torna a conversão idempotente.</summary>
    public Guid? LeadId { get; private set; }
    public string Name { get; private set; } = "";
    public string? LegalName { get; private set; }
    public string? Cnpj { get; private set; }
    public string? Segment { get; private set; }
    public string? City { get; private set; }
    public string? State { get; private set; }
    public string? ContactName { get; private set; }
    public string? ContactWhatsapp { get; private set; }
    public ClientStatus Status { get; private set; }
    public decimal ImplementationFee { get; private set; }
    public decimal MonthlyFee { get; private set; }
    public int DueDay { get; private set; }
    public DateOnly ClientSince { get; private set; }
    public DateTimeOffset? NextMeeting { get; private set; }
    public Guid? ResponsibleId { get; private set; }
    public string? Notes { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public uint Version { get; private set; }

    public static Client Create(string name, decimal implementationFee, decimal monthlyFee, int dueDay,
        DateOnly clientSince, Guid? responsibleId, DateTimeOffset now)
    {
        var client = new Client
        {
            Id = Guid.NewGuid(),
            Status = ClientStatus.Implementacao,
            ClientSince = clientSince,
            ResponsibleId = responsibleId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        client.SetName(name);
        client.SetFees(implementationFee, monthlyFee, dueDay);
        return client;
    }

    /// <summary>Converte um lead em cliente, fechando o lead. Retorna também a etapa anterior do lead.</summary>
    public static (Client Client, LeadStage PreviousStage) ConvertFrom(
        Lead lead, decimal implementationFee, decimal monthlyFee, int dueDay, Guid? responsibleId,
        DateOnly today, DateTimeOffset now)
    {
        var previous = lead.MarkClosed(now);
        var client = Create(lead.Company, implementationFee, monthlyFee, dueDay, today, responsibleId ?? lead.OwnerId, now);
        client.LeadId = lead.Id;
        client.Segment = lead.Segment;
        client.City = lead.City;
        client.State = lead.State;
        client.ContactName = lead.ContactName;
        client.ContactWhatsapp = lead.Whatsapp;
        return (client, previous);
    }

    public void UpdateDetails(
        string name, string? legalName, string? cnpj, string? segment, string? city, string? state,
        string? contactName, string? contactWhatsapp, decimal implementationFee, decimal monthlyFee,
        int dueDay, DateTimeOffset? nextMeeting, Guid? responsibleId, string? notes, DateTimeOffset now)
    {
        if (state is { Length: not 2 }) throw new DomainException("A UF deve ter 2 letras.");
        var digits = cnpj is null ? null : new string(cnpj.Where(char.IsDigit).ToArray());
        if (!string.IsNullOrEmpty(digits) && digits.Length != 14) throw new DomainException("CNPJ inválido.");

        SetName(name);
        SetFees(implementationFee, monthlyFee, dueDay);
        LegalName = Clean(legalName);
        Cnpj = string.IsNullOrEmpty(digits) ? null : digits;
        Segment = Clean(segment);
        City = Clean(city);
        State = Clean(state)?.ToUpperInvariant();
        ContactName = Clean(contactName);
        ContactWhatsapp = Clean(contactWhatsapp);
        NextMeeting = nextMeeting;
        ResponsibleId = responsibleId;
        Notes = Clean(notes);
        UpdatedAt = now;
    }

    public ClientStatus ChangeStatus(ClientStatus target, DateTimeOffset now)
    {
        if (!Enum.IsDefined(target)) throw new DomainException("Status inválido.");
        if (Status == ClientStatus.Encerrado && target != ClientStatus.Encerrado)
            throw new DomainException("Um cliente encerrado não pode ser reativado; cadastre um novo contrato.");
        var from = Status;
        Status = target;
        UpdatedAt = now;
        return from;
    }

    private void SetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new DomainException("Informe o nome do cliente.");
        Name = name.Trim();
    }

    private void SetFees(decimal implementationFee, decimal monthlyFee, int dueDay)
    {
        if (implementationFee < 0 || monthlyFee < 0) throw new DomainException("Valores não podem ser negativos.");
        if (dueDay is < 1 or > 28) throw new DomainException("O dia de vencimento deve estar entre 1 e 28.");
        ImplementationFee = decimal.Round(implementationFee, 2);
        MonthlyFee = decimal.Round(monthlyFee, 2);
        DueDay = dueDay;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

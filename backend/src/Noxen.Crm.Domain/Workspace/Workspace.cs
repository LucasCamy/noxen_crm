namespace Noxen.Crm.Domain.Workspace;

public enum Priority
{
    Alta = 0,
    Media = 1,
    Baixa = 2,
}

internal static class Text
{
    public static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    public static string Required(string? v, string message) =>
        string.IsNullOrWhiteSpace(v) ? throw new DomainException(message) : v.Trim();
}

// ---------------------------------------------------------------- tarefas

public enum TodoStatus
{
    Aberta = 0,
    EmAndamento = 1,
    Concluida = 2,
    Cancelada = 3,
}

/// <summary>Tarefa do planejamento, opcionalmente ligada a um cliente ou lead.</summary>
public sealed class TaskItem
{
    private TaskItem() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public string? Notes { get; private set; }
    public string? Type { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public Priority Priority { get; private set; }
    public TodoStatus Status { get; private set; }
    public Guid? ClientId { get; private set; }
    public Guid? LeadId { get; private set; }
    public Guid? AssigneeId { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static TaskItem Create(string title, string? notes, string? type, DateOnly? dueDate, Priority priority, Guid? clientId,
        Guid? leadId, Guid? assigneeId, DateTimeOffset now)
    {
        var t = new TaskItem { Id = Guid.NewGuid(), Status = TodoStatus.Aberta, CreatedAt = now, UpdatedAt = now };
        t.Apply(title, notes, type, dueDate, priority, clientId, leadId, assigneeId);
        return t;
    }

    public void Update(string title, string? notes, string? type, DateOnly? dueDate, Priority priority, Guid? clientId,
        Guid? leadId, Guid? assigneeId, DateTimeOffset now)
    {
        Apply(title, notes, type, dueDate, priority, clientId, leadId, assigneeId);
        UpdatedAt = now;
    }

    public void SetStatus(TodoStatus status, DateTimeOffset now)
    {
        if (!Enum.IsDefined(status)) throw new DomainException("Status inválido.");
        if (status == Status) return;
        Status = status;
        CompletedAt = status == TodoStatus.Concluida ? now : null;
        UpdatedAt = now;
    }

    public bool IsOpen => Status is TodoStatus.Aberta or TodoStatus.EmAndamento;
    public bool IsOverdue(DateOnly today) => IsOpen && DueDate < today;

    private void Apply(string title, string? notes, string? type, DateOnly? dueDate, Priority priority, Guid? clientId, Guid? leadId, Guid? assigneeId)
    {
        if (!Enum.IsDefined(priority)) throw new DomainException("Prioridade inválida.");
        Title = Text.Required(title, "Informe o título da tarefa.");
        Notes = Text.Clean(notes);
        Type = Text.Clean(type);
        DueDate = dueDate;
        Priority = priority;
        ClientId = clientId;
        LeadId = leadId;
        AssigneeId = assigneeId;
    }
}

// ---------------------------------------------------------------- ideias

public enum IdeaStatus
{
    Nova = 0,
    EmAnalise = 1,
    Aprovada = 2,
    EmExecucao = 3,
    Descartada = 4,
}

public sealed class Idea
{
    private Idea() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public string? Category { get; private set; }
    public Priority Priority { get; private set; }
    public IdeaStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public string? NextStep { get; private set; }
    public DateOnly? Date { get; private set; }
    public Guid? ClientId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static Idea Create(string title, string? category, Priority priority, IdeaStatus status, string? notes, string? nextStep,
        DateOnly? date, Guid? clientId, DateTimeOffset now)
    {
        var i = new Idea { Id = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now };
        i.Apply(title, category, priority, status, notes, nextStep, date, clientId);
        return i;
    }

    public void Update(string title, string? category, Priority priority, IdeaStatus status, string? notes, string? nextStep,
        DateOnly? date, Guid? clientId, DateTimeOffset now)
    {
        Apply(title, category, priority, status, notes, nextStep, date, clientId);
        UpdatedAt = now;
    }

    private void Apply(string title, string? category, Priority priority, IdeaStatus status, string? notes, string? nextStep, DateOnly? date, Guid? clientId)
    {
        if (!Enum.IsDefined(priority) || !Enum.IsDefined(status)) throw new DomainException("Prioridade ou status inválido.");
        Title = Text.Required(title, "Informe o título da ideia.");
        Category = Text.Clean(category);
        Priority = priority;
        Status = status;
        Notes = Text.Clean(notes);
        NextStep = Text.Clean(nextStep);
        Date = date;
        ClientId = clientId;
    }
}

// ---------------------------------------------------------------- scripts comerciais

public enum ScriptStage
{
    AbordagemInicial = 0,
    Qualificacao = 1,
    FollowUp = 2,
    RespostaDoLead = 3,
    Objecoes = 4,
    Fechamento = 5,
    Parceria = 6,
}

/// <summary>Modelo de mensagem comercial. O corpo aceita {{empresa}}, {{contato}} e {{meu_nome}}.</summary>
public sealed class ScriptTemplate
{
    private ScriptTemplate() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public ScriptStage Stage { get; private set; }
    public string? Channel { get; private set; }
    public string? Niche { get; private set; }
    public string? Usage { get; private set; }
    public string Body { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static ScriptTemplate Create(string title, ScriptStage stage, string? channel, string? niche, string? usage, string body, DateTimeOffset now)
    {
        var s = new ScriptTemplate { Id = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now };
        s.Apply(title, stage, channel, niche, usage, body);
        return s;
    }

    public void Update(string title, ScriptStage stage, string? channel, string? niche, string? usage, string body, DateTimeOffset now)
    {
        Apply(title, stage, channel, niche, usage, body);
        UpdatedAt = now;
    }

    private void Apply(string title, ScriptStage stage, string? channel, string? niche, string? usage, string body)
    {
        if (!Enum.IsDefined(stage)) throw new DomainException("Etapa inválida.");
        Title = Text.Required(title, "Informe o título do script.");
        Body = Text.Required(body, "Escreva o texto do script.");
        Stage = stage;
        Channel = Text.Clean(channel);
        Niche = Text.Clean(niche);
        Usage = Text.Clean(usage);
    }
}

// ---------------------------------------------------------------- conteúdos

public enum ContentFormat
{
    Post = 0,
    Carrossel = 1,
    Reels = 2,
    Story = 3,
    Anuncio = 4,
    Video = 5,
    Outro = 6,
}

public enum ContentStatus
{
    Ideia = 0,
    Roteiro = 1,
    Producao = 2,
    Aprovacao = 3,
    Agendado = 4,
    Publicado = 5,
}

/// <summary>Peça de conteúdo (post, roteiro, anúncio) de um cliente ou da própria agência.</summary>
public sealed class ContentItem
{
    private ContentItem() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public ContentFormat Format { get; private set; }
    public ContentStatus Status { get; private set; }
    public string? Channel { get; private set; }
    public string? Objective { get; private set; }
    public DateOnly? PublishDate { get; private set; }
    public Guid? ClientId { get; private set; }
    public string? Body { get; private set; }
    public Guid? CreatedById { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static ContentItem Create(string title, ContentFormat format, ContentStatus status, string? channel, string? objective,
        DateOnly? publishDate, Guid? clientId, string? body, Guid? createdById, DateTimeOffset now)
    {
        var c = new ContentItem { Id = Guid.NewGuid(), CreatedById = createdById, CreatedAt = now, UpdatedAt = now };
        c.Apply(title, format, status, channel, objective, publishDate, clientId, body);
        return c;
    }

    public void Update(string title, ContentFormat format, ContentStatus status, string? channel, string? objective,
        DateOnly? publishDate, Guid? clientId, string? body, DateTimeOffset now)
    {
        Apply(title, format, status, channel, objective, publishDate, clientId, body);
        UpdatedAt = now;
    }

    private void Apply(string title, ContentFormat format, ContentStatus status, string? channel, string? objective,
        DateOnly? publishDate, Guid? clientId, string? body)
    {
        if (!Enum.IsDefined(format) || !Enum.IsDefined(status)) throw new DomainException("Formato ou status inválido.");
        if (status == ContentStatus.Agendado && publishDate is null) throw new DomainException("Informe a data de publicação para agendar.");
        Title = Text.Required(title, "Informe o título do conteúdo.");
        Format = format;
        Status = status;
        Channel = Text.Clean(channel);
        Objective = Text.Clean(objective);
        PublishDate = publishDate;
        ClientId = clientId;
        Body = Text.Clean(body);
    }
}

// ---------------------------------------------------------------- base estratégica

/// <summary>Seção da base de conhecimento da agência (posicionamento, ofertas, tom de voz).</summary>
public sealed class KnowledgeDoc
{
    private KnowledgeDoc() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public string Body { get; private set; } = "";
    public string? Source { get; private set; }
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static KnowledgeDoc Create(string title, string body, string? source, int sortOrder, DateTimeOffset now)
    {
        var d = new KnowledgeDoc { Id = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now };
        d.Apply(title, body, source, sortOrder);
        return d;
    }

    public void Update(string title, string body, string? source, int sortOrder, DateTimeOffset now)
    {
        Apply(title, body, source, sortOrder);
        UpdatedAt = now;
    }

    private void Apply(string title, string body, string? source, int sortOrder)
    {
        Title = Text.Required(title, "Informe o título da seção.");
        Body = Text.Required(body, "Escreva o conteúdo da seção.");
        Source = Text.Clean(source);
        SortOrder = sortOrder;
    }
}

using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Domain.Workspace;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Workspace;

// ---------------------------------------------------------------- DTOs

public record TaskInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    [MaxLength(4000)] public string? Notes { get; init; }
    [MaxLength(60)] public string? Type { get; init; }
    public DateOnly? DueDate { get; init; }
    public Priority Priority { get; init; } = Priority.Media;
    public Guid? ClientId { get; init; }
    public Guid? LeadId { get; init; }
    public Guid? AssigneeId { get; init; }
}

public sealed record UpdateTaskRequest : TaskInput
{
    public uint Version { get; init; }
}

public sealed record TaskStatusRequest(TodoStatus Status, uint Version);

public sealed record TaskResponse(Guid Id, string Title, string? Notes, string? Type, DateOnly? DueDate, Priority Priority, TodoStatus Status,
    Guid? ClientId, string? ClientName, Guid? LeadId, Guid? AssigneeId, DateTimeOffset? CompletedAt, bool Overdue, uint Version);

public record IdeaInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    [MaxLength(100)] public string? Category { get; init; }
    public Priority Priority { get; init; } = Priority.Media;
    public IdeaStatus Status { get; init; } = IdeaStatus.Nova;
    [MaxLength(4000)] public string? Notes { get; init; }
    [MaxLength(500)] public string? NextStep { get; init; }
    public DateOnly? Date { get; init; }
    public Guid? ClientId { get; init; }
}

public sealed record UpdateIdeaRequest : IdeaInput
{
    public uint Version { get; init; }
}

public sealed record IdeaResponse(Guid Id, string Title, string? Category, Priority Priority, IdeaStatus Status, string? Notes, string? NextStep,
    DateOnly? Date, Guid? ClientId, string? ClientName, uint Version);

public record ScriptInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    public ScriptStage Stage { get; init; }
    [MaxLength(100)] public string? Channel { get; init; }
    [MaxLength(100)] public string? Niche { get; init; }
    [MaxLength(500)] public string? Usage { get; init; }
    [Required, MaxLength(8000)] public string Body { get; init; } = "";
}

public sealed record UpdateScriptRequest : ScriptInput
{
    public uint Version { get; init; }
}

public sealed record ScriptResponse(Guid Id, string Title, ScriptStage Stage, string? Channel, string? Niche, string? Usage, string Body, uint Version);

public record ContentInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    public ContentFormat Format { get; init; } = ContentFormat.Post;
    public ContentStatus Status { get; init; } = ContentStatus.Ideia;
    [MaxLength(100)] public string? Channel { get; init; }
    [MaxLength(500)] public string? Objective { get; init; }
    public DateOnly? PublishDate { get; init; }
    public Guid? ClientId { get; init; }
    [MaxLength(20000)] public string? Body { get; init; }
}

public sealed record UpdateContentRequest : ContentInput
{
    public uint Version { get; init; }
}

public sealed record ContentResponse(Guid Id, string Title, ContentFormat Format, ContentStatus Status, string? Channel, string? Objective,
    DateOnly? PublishDate, Guid? ClientId, string? ClientName, string? Body, uint Version);

public record KnowledgeInput
{
    [Required, MaxLength(200)] public string Title { get; init; } = "";
    [Required, MaxLength(20000)] public string Body { get; init; } = "";
    [MaxLength(300)] public string? Source { get; init; }
    public int SortOrder { get; init; }
}

public sealed record UpdateKnowledgeRequest : KnowledgeInput
{
    public uint Version { get; init; }
}

public sealed record KnowledgeResponse(Guid Id, string Title, string Body, string? Source, int SortOrder, uint Version);

/// <summary>Item da agenda unificada: tarefas, follow-ups de leads, reuniões, vencimentos e publicações.</summary>
public sealed record PlanningItem(DateOnly Date, string Kind, string Title, string? Subtitle, string Link, bool Overdue);

public static class WorkspaceEndpoints
{
    private const int MaxList = 500;

    public static void MapWorkspace(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api").WithTags("Workspace");

        // ---- tarefas
        g.MapGet("/tasks", ListTasks);
        g.MapPost("/tasks", CreateTask).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/tasks/{id:guid}", UpdateTask).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPost("/tasks/{id:guid}/status", SetTaskStatus).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/tasks/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.Tasks, id)).RequireAuthorization(Policies.CanWriteMarketing);

        // ---- ideias
        g.MapGet("/ideas", ListIdeas);
        g.MapPost("/ideas", CreateIdea).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/ideas/{id:guid}", UpdateIdea).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/ideas/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.Ideas, id)).RequireAuthorization(Policies.CanWriteMarketing);

        // ---- scripts
        g.MapGet("/scripts", async (CrmDbContext db, ScriptStage? stage) =>
            Results.Ok((await db.Scripts.AsNoTracking().Where(s => stage == null || s.Stage == stage).OrderBy(s => s.Stage).ThenBy(s => s.Title).Take(MaxList).ToListAsync()).Select(ToResponse)));
        g.MapPost("/scripts", CreateScript).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/scripts/{id:guid}", UpdateScript).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/scripts/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.Scripts, id)).RequireAuthorization(Policies.CanWriteMarketing);

        // ---- conteúdos
        g.MapGet("/contents", ListContents);
        g.MapPost("/contents", CreateContent).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/contents/{id:guid}", UpdateContent).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/contents/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.Contents, id)).RequireAuthorization(Policies.CanWriteMarketing);

        // ---- base estratégica
        g.MapGet("/knowledge", async (CrmDbContext db) =>
            Results.Ok((await db.KnowledgeDocs.AsNoTracking().OrderBy(d => d.SortOrder).ThenBy(d => d.Title).Take(MaxList).ToListAsync()).Select(ToResponse)));
        g.MapPost("/knowledge", CreateKnowledge).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapPut("/knowledge/{id:guid}", UpdateKnowledge).RequireAuthorization(Policies.CanWriteMarketing);
        g.MapDelete("/knowledge/{id:guid}", (Guid id, CrmDbContext db) => Delete(db, db.KnowledgeDocs, id)).RequireAuthorization(Policies.CanWriteMarketing);

        // ---- agenda
        g.MapGet("/planning", Planning);
    }

    private static DateOnly Today(TimeProvider clock) => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

    private static async Task<IResult> Delete<T>(CrmDbContext db, DbSet<T> set, Guid id) where T : class
    {
        var entity = await set.FindAsync(id);
        if (entity is null) return Results.NotFound();
        set.Remove(entity);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> ValidateRefs(CrmDbContext db, Guid? clientId, Guid? leadId = null, Guid? assigneeId = null)
    {
        if (clientId is not null && !await db.Clients.AnyAsync(c => c.Id == clientId)) return Results.Problem(statusCode: 422, title: "Cliente não encontrado.");
        if (leadId is not null && !await db.Leads.AnyAsync(l => l.Id == leadId)) return Results.Problem(statusCode: 422, title: "Lead não encontrado.");
        if (assigneeId is not null && !await db.Users.AnyAsync(u => u.Id == assigneeId)) return Results.Problem(statusCode: 422, title: "Responsável não encontrado.");
        return Results.Empty;
    }

    private static async Task<Dictionary<Guid, string>> ClientNames(CrmDbContext db, IEnumerable<Guid?> ids)
    {
        var wanted = ids.Where(i => i is not null).Select(i => i!.Value).Distinct().ToList();
        return wanted.Count == 0 ? [] : await db.Clients.AsNoTracking().Where(c => wanted.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name);
    }

    // ------------------------------------------------------------ tarefas

    private static TaskResponse ToResponse(TaskItem t, string? clientName, DateOnly today) => new(t.Id, t.Title, t.Notes, t.Type, t.DueDate, t.Priority,
        t.Status, t.ClientId, clientName, t.LeadId, t.AssigneeId, t.CompletedAt, t.IsOverdue(today), t.Version);

    private static async Task<IResult> ListTasks(CrmDbContext db, TimeProvider clock, TodoStatus? status, bool? open, Guid? clientId, Guid? assigneeId)
    {
        var query = db.Tasks.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(t => t.Status == status);
        if (open == true) query = query.Where(t => t.Status == TodoStatus.Aberta || t.Status == TodoStatus.EmAndamento);
        if (clientId is not null) query = query.Where(t => t.ClientId == clientId);
        if (assigneeId is not null) query = query.Where(t => t.AssigneeId == assigneeId);
        var items = await query.OrderBy(t => t.Status == TodoStatus.Concluida || t.Status == TodoStatus.Cancelada).ThenBy(t => t.DueDate == null)
            .ThenBy(t => t.DueDate).ThenBy(t => t.Priority).ThenBy(t => t.Id).Take(MaxList).ToListAsync();
        var names = await ClientNames(db, items.Select(t => t.ClientId));
        var today = Today(clock);
        return Results.Ok(items.Select(t => ToResponse(t, t.ClientId is { } c ? names.GetValueOrDefault(c) : null, today)));
    }

    private static async Task<IResult> CreateTask(TaskInput i, CrmDbContext db, TimeProvider clock)
    {
        var bad = await ValidateRefs(db, i.ClientId, i.LeadId, i.AssigneeId);
        if (bad != Results.Empty) return bad;
        var t = TaskItem.Create(i.Title, i.Notes, i.Type, i.DueDate, i.Priority, i.ClientId, i.LeadId, i.AssigneeId, clock.GetUtcNow());
        db.Tasks.Add(t);
        await db.SaveChangesAsync();
        return Results.Created($"/api/tasks/{t.Id}", await Single(db, t, clock));
    }

    private static async Task<IResult> UpdateTask(Guid id, UpdateTaskRequest r, CrmDbContext db, TimeProvider clock)
    {
        var t = await db.Tasks.SingleOrDefaultAsync(x => x.Id == id);
        if (t is null) return Results.NotFound();
        var bad = await ValidateRefs(db, r.ClientId, r.LeadId, r.AssigneeId);
        if (bad != Results.Empty) return bad;
        db.Entry(t).Property(x => x.Version).OriginalValue = r.Version;
        t.Update(r.Title, r.Notes, r.Type, r.DueDate, r.Priority, r.ClientId, r.LeadId, r.AssigneeId, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(await Single(db, t, clock));
    }

    private static async Task<IResult> SetTaskStatus(Guid id, TaskStatusRequest r, CrmDbContext db, TimeProvider clock)
    {
        var t = await db.Tasks.SingleOrDefaultAsync(x => x.Id == id);
        if (t is null) return Results.NotFound();
        db.Entry(t).Property(x => x.Version).OriginalValue = r.Version;
        t.SetStatus(r.Status, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(await Single(db, t, clock));
    }

    private static async Task<TaskResponse> Single(CrmDbContext db, TaskItem t, TimeProvider clock)
    {
        var names = await ClientNames(db, [t.ClientId]);
        return ToResponse(t, t.ClientId is { } c ? names.GetValueOrDefault(c) : null, Today(clock));
    }

    // ------------------------------------------------------------ ideias

    private static IdeaResponse ToResponse(Idea i, string? clientName) => new(i.Id, i.Title, i.Category, i.Priority, i.Status, i.Notes, i.NextStep, i.Date, i.ClientId, clientName, i.Version);

    private static async Task<IResult> ListIdeas(CrmDbContext db, IdeaStatus? status)
    {
        var query = db.Ideas.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(i => i.Status == status);
        var items = await query.OrderBy(i => i.Status == IdeaStatus.Descartada).ThenBy(i => i.Priority).ThenByDescending(i => i.CreatedAt).Take(MaxList).ToListAsync();
        var names = await ClientNames(db, items.Select(i => i.ClientId));
        return Results.Ok(items.Select(i => ToResponse(i, i.ClientId is { } c ? names.GetValueOrDefault(c) : null)));
    }

    private static async Task<IResult> CreateIdea(IdeaInput i, CrmDbContext db, TimeProvider clock)
    {
        var bad = await ValidateRefs(db, i.ClientId);
        if (bad != Results.Empty) return bad;
        var idea = Idea.Create(i.Title, i.Category, i.Priority, i.Status, i.Notes, i.NextStep, i.Date, i.ClientId, clock.GetUtcNow());
        db.Ideas.Add(idea);
        await db.SaveChangesAsync();
        return Results.Created($"/api/ideas/{idea.Id}", ToResponse(idea, null));
    }

    private static async Task<IResult> UpdateIdea(Guid id, UpdateIdeaRequest r, CrmDbContext db, TimeProvider clock)
    {
        var idea = await db.Ideas.SingleOrDefaultAsync(x => x.Id == id);
        if (idea is null) return Results.NotFound();
        var bad = await ValidateRefs(db, r.ClientId);
        if (bad != Results.Empty) return bad;
        db.Entry(idea).Property(x => x.Version).OriginalValue = r.Version;
        idea.Update(r.Title, r.Category, r.Priority, r.Status, r.Notes, r.NextStep, r.Date, r.ClientId, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(idea, null));
    }

    // ------------------------------------------------------------ scripts

    private static ScriptResponse ToResponse(ScriptTemplate s) => new(s.Id, s.Title, s.Stage, s.Channel, s.Niche, s.Usage, s.Body, s.Version);

    private static async Task<IResult> CreateScript(ScriptInput i, CrmDbContext db, TimeProvider clock)
    {
        var s = ScriptTemplate.Create(i.Title, i.Stage, i.Channel, i.Niche, i.Usage, i.Body, clock.GetUtcNow());
        db.Scripts.Add(s);
        await db.SaveChangesAsync();
        return Results.Created($"/api/scripts/{s.Id}", ToResponse(s));
    }

    private static async Task<IResult> UpdateScript(Guid id, UpdateScriptRequest r, CrmDbContext db, TimeProvider clock)
    {
        var s = await db.Scripts.SingleOrDefaultAsync(x => x.Id == id);
        if (s is null) return Results.NotFound();
        db.Entry(s).Property(x => x.Version).OriginalValue = r.Version;
        s.Update(r.Title, r.Stage, r.Channel, r.Niche, r.Usage, r.Body, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(s));
    }

    // ------------------------------------------------------------ conteúdos

    private static ContentResponse ToResponse(ContentItem c, string? clientName) => new(c.Id, c.Title, c.Format, c.Status, c.Channel, c.Objective, c.PublishDate, c.ClientId, clientName, c.Body, c.Version);

    private static async Task<IResult> ListContents(CrmDbContext db, ContentStatus? status, Guid? clientId, string? channel)
    {
        var query = db.Contents.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(c => c.Status == status);
        if (clientId is not null) query = query.Where(c => c.ClientId == clientId);
        if (!string.IsNullOrWhiteSpace(channel)) query = query.Where(c => c.Channel == channel);
        var items = await query.OrderBy(c => c.PublishDate == null).ThenBy(c => c.PublishDate).ThenByDescending(c => c.CreatedAt).Take(MaxList).ToListAsync();
        var names = await ClientNames(db, items.Select(c => c.ClientId));
        return Results.Ok(items.Select(c => ToResponse(c, c.ClientId is { } cid ? names.GetValueOrDefault(cid) : null)));
    }

    private static async Task<IResult> CreateContent(ContentInput i, CrmDbContext db, TimeProvider clock, ClaimsPrincipal user)
    {
        var bad = await ValidateRefs(db, i.ClientId);
        if (bad != Results.Empty) return bad;
        var c = ContentItem.Create(i.Title, i.Format, i.Status, i.Channel, i.Objective, i.PublishDate, i.ClientId, i.Body, user.GetUserId(), clock.GetUtcNow());
        db.Contents.Add(c);
        await db.SaveChangesAsync();
        return Results.Created($"/api/contents/{c.Id}", ToResponse(c, null));
    }

    private static async Task<IResult> UpdateContent(Guid id, UpdateContentRequest r, CrmDbContext db, TimeProvider clock)
    {
        var c = await db.Contents.SingleOrDefaultAsync(x => x.Id == id);
        if (c is null) return Results.NotFound();
        var bad = await ValidateRefs(db, r.ClientId);
        if (bad != Results.Empty) return bad;
        db.Entry(c).Property(x => x.Version).OriginalValue = r.Version;
        c.Update(r.Title, r.Format, r.Status, r.Channel, r.Objective, r.PublishDate, r.ClientId, r.Body, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(c, null));
    }

    // ------------------------------------------------------------ base estratégica

    private static KnowledgeResponse ToResponse(KnowledgeDoc d) => new(d.Id, d.Title, d.Body, d.Source, d.SortOrder, d.Version);

    private static async Task<IResult> CreateKnowledge(KnowledgeInput i, CrmDbContext db, TimeProvider clock)
    {
        var d = KnowledgeDoc.Create(i.Title, i.Body, i.Source, i.SortOrder, clock.GetUtcNow());
        db.KnowledgeDocs.Add(d);
        await db.SaveChangesAsync();
        return Results.Created($"/api/knowledge/{d.Id}", ToResponse(d));
    }

    private static async Task<IResult> UpdateKnowledge(Guid id, UpdateKnowledgeRequest r, CrmDbContext db, TimeProvider clock)
    {
        var d = await db.KnowledgeDocs.SingleOrDefaultAsync(x => x.Id == id);
        if (d is null) return Results.NotFound();
        db.Entry(d).Property(x => x.Version).OriginalValue = r.Version;
        d.Update(r.Title, r.Body, r.Source, r.SortOrder, clock.GetUtcNow());
        await db.SaveChangesAsync();
        return Results.Ok(ToResponse(d));
    }

    // ------------------------------------------------------------ agenda

    /// <summary>
    /// Agenda unificada entre `from` e `to` (padrão: hoje e os próximos 14 dias), mais o que já estava atrasado antes de `from`.
    /// Cobranças só aparecem para quem acessa o financeiro.
    /// </summary>
    private static async Task<IResult> Planning(CrmDbContext db, TimeProvider clock, ClaimsPrincipal user, DateOnly? from, DateOnly? to)
    {
        var start = from ?? Today(clock);
        var end = to ?? start.AddDays(14);
        if (end < start || end.DayNumber - start.DayNumber > 92) return Results.Problem(statusCode: 400, title: "Período inválido (máximo de 92 dias).");

        var items = new List<PlanningItem>();

        var tasks = await db.Tasks.AsNoTracking()
            .Where(t => (t.Status == TodoStatus.Aberta || t.Status == TodoStatus.EmAndamento) && t.DueDate != null && t.DueDate <= end).Take(MaxList).ToListAsync();
        items.AddRange(tasks.Select(t => new PlanningItem(t.DueDate!.Value, "Tarefa", t.Title, t.Type, "/planning", t.DueDate < start)));

        var leads = await db.Leads.AsNoTracking()
            .Where(l => l.Stage != LeadStage.Fechado && l.Stage != LeadStage.Perdido && l.NextStepDate != null && l.NextStepDate <= end).Take(MaxList).ToListAsync();
        items.AddRange(leads.Select(l => new PlanningItem(l.NextStepDate!.Value, "Follow-up", l.Company, l.NextStep, "/leads", l.NextStepDate < start)));

        var from0 = new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var to0 = new DateTimeOffset(end.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var meetings = await db.Clients.AsNoTracking().Where(c => c.NextMeeting != null && c.NextMeeting >= from0 && c.NextMeeting < to0).Take(MaxList).ToListAsync();
        items.AddRange(meetings.Select(c => new PlanningItem(DateOnly.FromDateTime(c.NextMeeting!.Value.UtcDateTime), "Reunião", c.Name,
            c.NextMeeting!.Value.UtcDateTime.ToString("HH:mm") + " UTC", $"/clients/{c.Id}", false)));

        var contents = await db.Contents.AsNoTracking()
            .Where(c => c.Status != ContentStatus.Publicado && c.PublishDate != null && c.PublishDate >= start && c.PublishDate <= end).Take(MaxList).ToListAsync();
        items.AddRange(contents.Select(c => new PlanningItem(c.PublishDate!.Value, "Conteúdo", c.Title, $"{c.Format} · {c.Status}", "/contents", false)));

        if (user.IsInRole(Roles.Admin) || user.IsInRole(Roles.Comercial))
        {
            var due = await db.Payments.AsNoTracking().Where(p => p.Status == PaymentStatus.Pendente && p.DueDate <= end)
                .Join(db.Clients, p => p.ClientId, c => c.Id, (p, c) => new { p.DueDate, p.Amount, p.ClientId, c.Name }).Take(MaxList).ToListAsync();
            items.AddRange(due.Select(p => new PlanningItem(p.DueDate, "Vencimento", p.Name, $"R$ {p.Amount:N2}", $"/clients/{p.ClientId}", p.DueDate < start)));
        }

        return Results.Ok(items.OrderBy(i => i.Date).ThenBy(i => i.Kind).ThenBy(i => i.Title).ToList());
    }
}

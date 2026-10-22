using System.Net;
using System.Net.Http.Json;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Finance;
using Noxen.Crm.Api.Leads;
using Noxen.Crm.Api.Workspace;
using Noxen.Crm.Domain;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Domain.Workspace;

namespace Noxen.Crm.Tests;

public class WorkspaceRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 22);

    [Fact]
    public void Task_completion_sets_and_clears_the_timestamp()
    {
        var t = TaskItem.Create("Enviar proposta", null, null, Today, Priority.Alta, null, null, null, Now);
        t.SetStatus(TodoStatus.Concluida, Now.AddHours(1));
        Assert.Equal(Now.AddHours(1), t.CompletedAt);
        t.SetStatus(TodoStatus.Aberta, Now.AddHours(2));
        Assert.Null(t.CompletedAt);
    }

    [Fact]
    public void Only_open_tasks_can_be_overdue()
    {
        var t = TaskItem.Create("Ligar", null, null, Today.AddDays(-1), Priority.Media, null, null, null, Now);
        Assert.True(t.IsOverdue(Today));
        t.SetStatus(TodoStatus.Concluida, Now);
        Assert.False(t.IsOverdue(Today));
        var undated = TaskItem.Create("Sem prazo", null, null, null, Priority.Baixa, null, null, null, Now);
        Assert.False(undated.IsOverdue(Today));
    }

    [Fact]
    public void Titles_and_bodies_are_required()
    {
        Assert.Throws<DomainException>(() => TaskItem.Create(" ", null, null, null, Priority.Media, null, null, null, Now));
        Assert.Throws<DomainException>(() => Idea.Create("", null, Priority.Media, IdeaStatus.Nova, null, null, null, null, Now));
        Assert.Throws<DomainException>(() => ScriptTemplate.Create("Abordagem", ScriptStage.AbordagemInicial, null, null, null, "  ", Now));
        Assert.Throws<DomainException>(() => KnowledgeDoc.Create("Tom de voz", "", null, 0, Now));
    }

    [Fact]
    public void Scheduling_a_content_requires_a_publish_date()
    {
        Assert.Throws<DomainException>(() => ContentItem.Create("Reels de Black Friday", ContentFormat.Reels, ContentStatus.Agendado, "Instagram", null, null, null, null, null, Now));
        var ok = ContentItem.Create("Reels de Black Friday", ContentFormat.Reels, ContentStatus.Agendado, "Instagram", null, Today.AddDays(3), null, null, null, Now);
        Assert.Equal(ContentStatus.Agendado, ok.Status);
    }
}

[Collection("api")]
public class WorkspaceApiTests(ApiFactory factory)
{
    private static async Task<T> ReadAsync<T>(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<T>(Json.Options))!;
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact]
    public async Task Everyone_authenticated_reads_and_every_role_writes_workspace_data_but_anonymous_cannot()
    {
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);
        var created = await marketing.PostAsJsonAsync("/api/ideas", new IdeaInput { Title = "Série de bastidores", Category = "Conteúdo" }, Json.Options);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var anon = factory.CreateClient();
        foreach (var url in new[] { "/api/tasks", "/api/ideas", "/api/scripts", "/api/contents", "/api/knowledge", "/api/planning" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.PostAsJsonAsync("/api/ideas", new IdeaInput { Title = "x" }, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Task_flow_complete_filter_validate_and_delete()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await ReadAsync<ClientResponse>(await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Cliente {Guid.NewGuid():N}", DueDay = 5 }, Json.Options));

        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/tasks", new TaskInput { Title = "" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/tasks", new TaskInput { Title = "x", ClientId = Guid.NewGuid() }, Json.Options)).StatusCode);

        var task = await ReadAsync<TaskResponse>(await http.PostAsJsonAsync("/api/tasks",
            new TaskInput { Title = "Revisar criativos", DueDate = Today.AddDays(-2), Priority = Priority.Alta, ClientId = client.Id }, Json.Options));
        Assert.True(task.Overdue);
        Assert.Equal(client.Name, task.ClientName);

        var open = await http.GetFromJsonAsync<List<TaskResponse>>($"/api/tasks?open=true&clientId={client.Id}", Json.Options);
        Assert.Single(open!);

        var done = await ReadAsync<TaskResponse>(await http.PostAsJsonAsync($"/api/tasks/{task.Id}/status", new TaskStatusRequest(TodoStatus.Concluida, task.Version), Json.Options));
        Assert.NotNull(done.CompletedAt);
        Assert.False(done.Overdue);
        Assert.Empty((await http.GetFromJsonAsync<List<TaskResponse>>($"/api/tasks?open=true&clientId={client.Id}", Json.Options))!);

        // versão antiga
        Assert.Equal(HttpStatusCode.Conflict, (await http.PostAsJsonAsync($"/api/tasks/{task.Id}/status", new TaskStatusRequest(TodoStatus.Aberta, task.Version), Json.Options)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/tasks/{task.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.DeleteAsync($"/api/tasks/{task.Id}")).StatusCode);
    }

    [Fact]
    public async Task Ideas_scripts_and_knowledge_crud_with_concurrency()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);

        var idea = await ReadAsync<IdeaResponse>(await http.PostAsJsonAsync("/api/ideas", new IdeaInput { Title = "Ebook de marketing local", Priority = Priority.Alta }, Json.Options));
        var upd = new UpdateIdeaRequest { Title = "Ebook de marketing local MS", Priority = Priority.Alta, Status = IdeaStatus.Aprovada, Version = idea.Version };
        Assert.Equal(HttpStatusCode.OK, (await http.PutAsJsonAsync($"/api/ideas/{idea.Id}", upd, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.PutAsJsonAsync($"/api/ideas/{idea.Id}", upd, Json.Options)).StatusCode);
        var approved = await http.GetFromJsonAsync<List<IdeaResponse>>("/api/ideas?status=Aprovada", Json.Options);
        Assert.Contains(approved!, i => i.Id == idea.Id);

        var script = await ReadAsync<ScriptResponse>(await http.PostAsJsonAsync("/api/scripts",
            new ScriptInput { Title = "Abordagem varejo", Stage = ScriptStage.AbordagemInicial, Channel = "WhatsApp", Body = "Oi {{contato}}, aqui é {{meu_nome}} da Noxen. Vi a {{empresa}}..." }, Json.Options));
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/scripts", new ScriptInput { Title = "Sem texto" }, Json.Options)).StatusCode);
        var byStage = await http.GetFromJsonAsync<List<ScriptResponse>>("/api/scripts?stage=AbordagemInicial", Json.Options);
        Assert.Contains(byStage!, s => s.Id == script.Id);
        Assert.DoesNotContain((await http.GetFromJsonAsync<List<ScriptResponse>>("/api/scripts?stage=Fechamento", Json.Options))!, s => s.Id == script.Id);

        var second = await ReadAsync<KnowledgeResponse>(await http.PostAsJsonAsync("/api/knowledge", new KnowledgeInput { Title = "Ofertas", Body = "Implementação de R$ 4.000 a R$ 8.000.", SortOrder = 20 }, Json.Options));
        var first = await ReadAsync<KnowledgeResponse>(await http.PostAsJsonAsync("/api/knowledge", new KnowledgeInput { Title = "Posicionamento", Body = "Fazemos empresas aumentarem o faturamento.", SortOrder = 10, Source = "Reunião de 22/10" }, Json.Options));
        var docs = (await http.GetFromJsonAsync<List<KnowledgeResponse>>("/api/knowledge", Json.Options))!;
        Assert.True(docs.FindIndex(d => d.Id == first.Id) < docs.FindIndex(d => d.Id == second.Id));
    }

    [Fact]
    public async Task Contents_validate_scheduling_filter_and_link_to_a_client()
    {
        var http = await factory.UserWithRoleAsync(Roles.Marketing);
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await ReadAsync<ClientResponse>(await comercial.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Cliente {Guid.NewGuid():N}", DueDay = 5 }, Json.Options));

        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await http.PostAsJsonAsync("/api/contents", new ContentInput { Title = "Reels", Format = ContentFormat.Reels, Status = ContentStatus.Agendado }, Json.Options)).StatusCode);

        var content = await ReadAsync<ContentResponse>(await http.PostAsJsonAsync("/api/contents",
            new ContentInput { Title = "Carrossel de dicas", Format = ContentFormat.Carrossel, Status = ContentStatus.Roteiro, Channel = "Instagram", PublishDate = Today.AddDays(2), ClientId = client.Id, Body = "Slide 1..." }, Json.Options));

        var filtered = await http.GetFromJsonAsync<List<ContentResponse>>($"/api/contents?clientId={client.Id}&status=Roteiro", Json.Options);
        var item = Assert.Single(filtered!);
        Assert.Equal(content.Id, item.Id);
        Assert.Equal(client.Name, item.ClientName);
        Assert.Empty((await http.GetFromJsonAsync<List<ContentResponse>>($"/api/contents?clientId={client.Id}&status=Publicado", Json.Options))!);
    }

    [Fact]
    public async Task Planning_merges_sources_flags_overdue_and_hides_billing_from_marketing()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);
        var marker = Guid.NewGuid().ToString("N")[..8];

        var client = await ReadAsync<ClientResponse>(await comercial.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Plan {marker}", DueDay = 5, MonthlyFee = 100 }, Json.Options));
        await comercial.PostAsJsonAsync($"/api/clients/{client.Id}/payments",
            new PaymentInput { Kind = PaymentKind.Avulso, ReferenceMonth = Today, Amount = 321, DueDate = Today.AddDays(1) }, Json.Options);
        await comercial.PostAsJsonAsync("/api/tasks", new TaskInput { Title = $"Tarefa {marker}", DueDate = Today.AddDays(3) }, Json.Options);
        await comercial.PostAsJsonAsync("/api/tasks", new TaskInput { Title = $"Atrasada {marker}", DueDate = Today.AddDays(-4) }, Json.Options);
        await comercial.PostAsJsonAsync("/api/tasks", new TaskInput { Title = $"Longe {marker}", DueDate = Today.AddDays(60) }, Json.Options);
        await comercial.PostAsJsonAsync("/api/leads", new LeadInput { Company = $"Lead {marker}", NextStep = "Ligar", NextStepDate = Today.AddDays(2) }, Json.Options);
        await marketing.PostAsJsonAsync("/api/contents", new ContentInput { Title = $"Post {marker}", PublishDate = Today.AddDays(4), Status = ContentStatus.Roteiro }, Json.Options);

        var asComercial = (await comercial.GetFromJsonAsync<List<PlanningItem>>("/api/planning", Json.Options))!.Where(i => i.Title.Contains(marker) || i.Amount == 321m).ToList();
        Assert.Contains(asComercial, i => i.Kind == "Tarefa" && i.Title == $"Tarefa {marker}" && !i.Overdue);
        Assert.Contains(asComercial, i => i.Kind == "Tarefa" && i.Title == $"Atrasada {marker}" && i.Overdue);
        Assert.DoesNotContain(asComercial, i => i.Title == $"Longe {marker}");
        Assert.Contains(asComercial, i => i.Kind == "Follow-up" && i.Title == $"Lead {marker}");
        Assert.Contains(asComercial, i => i.Kind == "Conteúdo");
        Assert.Contains(asComercial, i => i.Kind == "Vencimento" && i.Title == client.Name && i.Amount == 321m && i.Subtitle == "Cobrança avulsa");
        Assert.Equal(asComercial.Select(i => i.Date).Order().ToList(), asComercial.Select(i => i.Date).ToList());

        var asMarketing = (await marketing.GetFromJsonAsync<List<PlanningItem>>("/api/planning", Json.Options))!;
        Assert.DoesNotContain(asMarketing, i => i.Kind == "Vencimento");
        Assert.Contains(asMarketing, i => i.Title == $"Tarefa {marker}");

        Assert.Equal(HttpStatusCode.BadRequest, (await comercial.GetAsync($"/api/planning?from={Today:yyyy-MM-dd}&to={Today.AddDays(400):yyyy-MM-dd}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await comercial.GetAsync($"/api/planning?from={Today:yyyy-MM-dd}&to={Today.AddDays(-1):yyyy-MM-dd}")).StatusCode);
    }
}

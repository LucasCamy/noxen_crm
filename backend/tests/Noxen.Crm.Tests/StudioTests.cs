using System.Net;
using System.Net.Http.Json;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Studio;
using Noxen.Crm.Domain;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Studio;

namespace Noxen.Crm.Tests;

public class StudioRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Creation_stages_require_a_brief()
    {
        Assert.Throws<DomainException>(() => StudioProject.Create("Carrossel de Black Friday", null, StudioKind.Carrossel, StudioStatus.EmCriacao, " ", null, null, null, null, Now));
        var ok = StudioProject.Create("Carrossel de Black Friday", null, StudioKind.Carrossel, StudioStatus.EmCriacao, "Promover descontos", null, null, null, null, Now);
        Assert.Equal(StudioStatus.EmCriacao, ok.Status);
        // Briefing pode nascer sem texto
        Assert.Equal(StudioStatus.Briefing, StudioProject.Create("Novo", null, StudioKind.Imagem, StudioStatus.Briefing, null, null, null, null, null, Now).Status);
    }

    [Fact]
    public void Colors_are_validated_normalized_and_deduplicated()
    {
        var kit = BrandKit.Create(null, "Noxen", "5b3ae8, #0f172a ff00AA;5B3AE8", null, null, null, null, Now);
        Assert.Equal(["#5B3AE8", "#0F172A", "#FF00AA"], kit.ColorList);
        Assert.Throws<DomainException>(() => BrandKit.Create(null, "Ruim", "#12345", null, null, null, null, Now));
        Assert.Throws<DomainException>(() => BrandKit.Create(null, "Ruim", "red", null, null, null, null, Now));
        Assert.Empty(BrandKit.Create(null, "Sem cores", null, null, null, null, null, Now).ColorList);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:text/html,<script>alert(1)</script>")]
    [InlineData("ftp://exemplo.com/a")]
    [InlineData("exemplo.com/sem-esquema")]
    public void Only_http_links_are_accepted(string url)
    {
        Assert.Throws<DomainException>(() => ReferenceLink.Create("Ref", url, null, null, null, Now));
        Assert.Throws<DomainException>(() => BrandKit.Create(null, "Kit", "#FFFFFF", null, null, null, url, Now));
    }

    [Fact]
    public void Valid_links_are_kept()
    {
        Assert.Equal("https://www.behance.net/gallery/123", ReferenceLink.Create("Ref", "https://www.behance.net/gallery/123", null, null, null, Now).Url);
    }
}

[Collection("api")]
public class StudioApiTests(ApiFactory factory)
{
    private static async Task<T> ReadAsync<T>(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<T>(Json.Options))!;

    [Fact]
    public async Task Projects_crud_with_status_rule_concurrency_and_client_link()
    {
        var http = await factory.UserWithRoleAsync(Roles.Marketing);
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await ReadAsync<ClientResponse>(await comercial.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Cliente {Guid.NewGuid():N}", DueDay = 5 }, Json.Options));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/studio/projects", new ProjectInput { Title = "Sem briefing", Status = StudioStatus.EmCriacao }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/studio/projects", new ProjectInput { Title = "x", ClientId = Guid.NewGuid() }, Json.Options)).StatusCode);

        var project = await ReadAsync<ProjectResponse>(await http.PostAsJsonAsync("/api/studio/projects",
            new ProjectInput { Title = "Anúncio de verão", Kind = StudioKind.Anuncio, ClientId = client.Id, Brief = "Divulgar a coleção", DueDate = new DateOnly(2026, 12, 1) }, Json.Options));
        Assert.Equal(client.Name, project.ClientName);

        var update = new UpdateProjectRequest { Title = "Anúncio de verão", Kind = StudioKind.Anuncio, ClientId = client.Id, Brief = "Divulgar a coleção", Status = StudioStatus.Revisao, Version = project.Version };
        var moved = await ReadAsync<ProjectResponse>(await http.PutAsJsonAsync($"/api/studio/projects/{project.Id}", update, Json.Options));
        Assert.Equal(StudioStatus.Revisao, moved.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await http.PutAsJsonAsync($"/api/studio/projects/{project.Id}", update, Json.Options)).StatusCode);

        var inReview = await http.GetFromJsonAsync<List<ProjectResponse>>($"/api/studio/projects?status=Revisao&clientId={client.Id}", Json.Options);
        Assert.Single(inReview!);
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/studio/projects/{project.Id}")).StatusCode);
    }

    [Fact]
    public async Task Kits_and_references_validate_input_and_reject_script_urls()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);

        var kit = await ReadAsync<KitResponse>(await http.PostAsJsonAsync("/api/studio/kits", new KitInput { Name = "Noxen", Colors = "5b3ae8, #0f172a", Fonts = "Inter", LogoUrl = "https://exemplo.com/logo.svg" }, Json.Options));
        Assert.Equal(["#5B3AE8", "#0F172A"], kit.Colors);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/studio/kits", new KitInput { Name = "Ruim", Colors = "azul" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/studio/kits", new KitInput { Name = "Logo ruim", LogoUrl = "javascript:alert(1)" }, Json.Options)).StatusCode);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PostAsJsonAsync("/api/studio/references", new ReferenceInput { Title = "XSS", Url = "javascript:alert(1)" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/studio/references", new ReferenceInput { Title = "", Url = "https://x.com" }, Json.Options)).StatusCode);

        var tag = $"tag{Guid.NewGuid():N}"[..10];
        var reference = await ReadAsync<ReferenceResponse>(await http.PostAsJsonAsync("/api/studio/references", new ReferenceInput { Title = "Moodboard", Url = "https://www.behance.net/x", Tags = $"{tag}, branding" }, Json.Options));
        var found = await http.GetFromJsonAsync<List<ReferenceResponse>>($"/api/studio/references?tag={tag}", Json.Options);
        Assert.Contains(found!, r => r.Id == reference.Id);
        Assert.Empty((await http.GetFromJsonAsync<List<ReferenceResponse>>("/api/studio/references?tag=%25_inexistente", Json.Options))!);

        var upd = new UpdateReferenceRequest { Title = "Moodboard v2", Url = "https://www.behance.net/y", Version = reference.Version };
        Assert.Equal(HttpStatusCode.OK, (await http.PutAsJsonAsync($"/api/studio/references/{reference.Id}", upd, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.PutAsJsonAsync($"/api/studio/references/{reference.Id}", upd, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Studio_requires_authentication()
    {
        var anon = factory.CreateClient();
        foreach (var url in new[] { "/api/studio/projects", "/api/studio/kits", "/api/studio/references" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(url)).StatusCode);
    }
}

using System.Net;
using System.Net.Http.Json;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Leads;
using Noxen.Crm.Domain;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Leads;

namespace Noxen.Crm.Tests;

public class ClientProfileDomainTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 23, 12, 0, 0, TimeSpan.Zero);

    private static ClientProfile Profile(Action<ClientProfile>? tweak = null)
    {
        var p = ClientProfile.Create(Guid.NewGuid(), Now);
        tweak?.Invoke(p);
        return p;
    }

    private static void Update(ClientProfile p, string? website = null, string? instagram = null, string? facebook = null, string? tikTok = null, decimal? budget = null) =>
        p.Update(website, instagram, facebook, tikTok, null, null, null, null, null, null, null, null, null, null, budget, Now);

    [Theory]
    [InlineData("empresa.com.br", "https://empresa.com.br")]
    [InlineData("  http://empresa.com.br/ ", "http://empresa.com.br")]
    [InlineData("https://www.loja.com/produtos/", "https://www.loja.com/produtos")]
    public void Website_is_normalized_to_http_or_https(string input, string expected)
    {
        var p = Profile();
        Update(p, website: input);
        Assert.Equal(expected, p.Website);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://empresa.com.br")]
    [InlineData("semponto")]
    public void Website_rejects_other_schemes_and_hosts_without_a_dot(string input)
    {
        Assert.Throws<DomainException>(() => Update(Profile(), website: input));
        Assert.Throws<DomainException>(() => Update(Profile(), facebook: input));
        Assert.Throws<DomainException>(() => Update(Profile(), tikTok: input));
    }

    [Theory]
    [InlineData("@loja.noxen", "loja.noxen")]
    [InlineData("instagram.com/loja_1/", "loja_1")]
    [InlineData("https://www.instagram.com/loja?igsh=abc", "loja")]
    [InlineData("  Loja.Noxen ", "Loja.Noxen")]
    public void Instagram_keeps_only_the_handle(string input, string expected)
    {
        var p = Profile();
        Update(p, instagram: input);
        Assert.Equal(expected, p.Instagram);
    }

    [Theory]
    [InlineData("com espaço")]
    [InlineData("a/b")]
    [InlineData("nome-com-hifen")]
    public void Instagram_rejects_invalid_handles(string input) =>
        Assert.Throws<DomainException>(() => Update(Profile(), instagram: input));

    [Fact]
    public void Blank_fields_become_null_and_budget_cannot_be_negative()
    {
        var p = Profile();
        Update(p, website: "  ", instagram: "", budget: 1500.456m);
        Assert.Null(p.Website);
        Assert.Null(p.Instagram);
        Assert.Equal(1500.46m, p.AdBudget);
        Assert.Throws<DomainException>(() => Update(p, budget: -1));
    }

    [Fact]
    public void Access_requires_a_platform_and_trims_text()
    {
        Assert.Throws<DomainException>(() => ClientAccess.Create(Guid.NewGuid(), " ", null, null, null, null, null, Now));
        var a = ClientAccess.Create(Guid.NewGuid(), " Meta Business Manager ", " conta@x.com ", "Parceiro", "  ", null, null, Now);
        Assert.Equal("Meta Business Manager", a.Platform);
        Assert.Equal("conta@x.com", a.Account);
        Assert.Null(a.PasswordLocation);
    }

    [Fact]
    public void Lead_notes_are_trimmed_required_and_bounded()
    {
        var leadId = Guid.NewGuid();
        Assert.Equal("Pediu retorno na segunda.", LeadNote.Create(leadId, "  Pediu retorno na segunda.  ", null, Now).Text);
        Assert.Throws<DomainException>(() => LeadNote.Create(leadId, "   ", null, Now));
        Assert.Throws<DomainException>(() => LeadNote.Create(leadId, new string('x', LeadNote.MaxLength + 1), null, Now));
    }

    [Fact]
    public void Contract_details_validate_email_and_dates()
    {
        var lead = Lead.Create("Loja", LeadSource.Instagram, null, Now);
        var (client, _) = Client.ConvertFrom(lead, 4000, 1500, 10, null, new DateOnly(2026, 10, 23), Now);

        client.UpdateContract(" Contato@Loja.com.br ", "Tráfego pago e conteúdo", "Pix", new DateOnly(2026, 10, 1), new DateOnly(2027, 10, 1), "IPCA anual", Now);
        Assert.Equal("contato@loja.com.br", client.ContactEmail);
        Assert.Equal("Pix", client.PaymentMethod);

        Assert.Throws<DomainException>(() => client.UpdateContract("sem-arroba", null, null, null, null, null, Now));
        Assert.Throws<DomainException>(() => client.UpdateContract("a@b", null, null, null, null, null, Now));
        Assert.Throws<DomainException>(() => client.UpdateContract(null, null, null, new DateOnly(2026, 10, 2), new DateOnly(2026, 10, 1), null, Now));
    }
}

[Collection("api")]
public class Phase5ApiTests(ApiFactory factory)
{
    private static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(Json.Options))!;

    private static async Task<ClientResponse> CreateClientAsync(HttpClient http) =>
        await ReadAsync<ClientResponse>(await http.PostAsJsonAsync("/api/clients", new ClientInput { Name = $"Cliente {Guid.NewGuid():N}", DueDay = 5, MonthlyFee = 1500 }, Json.Options));

    private static async Task<LeadResponse> CreateLeadAsync(HttpClient http) =>
        await ReadAsync<LeadResponse>(await http.PostAsJsonAsync("/api/leads", new LeadInput { Company = $"Empresa {Guid.NewGuid():N}", Source = LeadSource.Instagram }, Json.Options));

    [Fact]
    public async Task Contract_fields_roundtrip_and_validate_through_the_client_api()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var created = await ReadAsync<ClientResponse>(await http.PostAsJsonAsync("/api/clients", new ClientInput
        {
            Name = $"Contrato {Guid.NewGuid():N}",
            DueDay = 8,
            MonthlyFee = 2000,
            ContactEmail = "Dono@Empresa.com",
            ContractedServices = "Gestão de tráfego e 12 posts por mês",
            PaymentMethod = "Boleto",
            ContractStart = new DateOnly(2026, 10, 1),
            ContractEnd = new DateOnly(2027, 3, 31),
            Readjustment = "IPCA em outubro",
        }, Json.Options));

        Assert.Equal("dono@empresa.com", created.ContactEmail);
        Assert.Equal("Boleto", created.PaymentMethod);
        Assert.Equal(new DateOnly(2027, 3, 31), created.ContractEnd);

        var read = await http.GetFromJsonAsync<ClientResponse>($"/api/clients/{created.Id}", Json.Options);
        Assert.Equal("IPCA em outubro", read!.Readjustment);

        var bad = new UpdateClientRequest { Name = created.Name, DueDay = 8, ContactEmail = "invalido", Version = created.Version };
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PutAsJsonAsync($"/api/clients/{created.Id}", bad, Json.Options)).StatusCode);
        var inverted = new UpdateClientRequest { Name = created.Name, DueDay = 8, ContractStart = new DateOnly(2026, 5, 2), ContractEnd = new DateOnly(2026, 5, 1), Version = created.Version };
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await http.PutAsJsonAsync($"/api/clients/{created.Id}", inverted, Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Profile_starts_empty_is_created_on_first_save_and_guards_concurrent_edits()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await CreateClientAsync(comercial);

        var empty = await comercial.GetFromJsonAsync<ClientProfileResponse>($"/api/clients/{client.Id}/profile", Json.Options);
        Assert.Equal(0u, empty!.Version);
        Assert.Null(empty.Website);

        Assert.Equal(HttpStatusCode.NotFound, (await comercial.GetAsync($"/api/clients/{Guid.NewGuid()}/profile")).StatusCode);

        // o Marketing escreve a ficha de marketing
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);
        var first = await marketing.PutAsJsonAsync($"/api/clients/{client.Id}/profile", new UpdateClientProfileRequest
        {
            Website = "empresa.com.br",
            Instagram = "@empresa",
            ToneOfVoice = "Próximo e direto",
            AdBudget = 3000,
            Version = 0,
        }, Json.Options);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var saved = await ReadAsync<ClientProfileResponse>(first);
        Assert.Equal("https://empresa.com.br", saved.Website);
        Assert.Equal("empresa", saved.Instagram);
        Assert.Equal(3000m, saved.AdBudget);
        Assert.NotEqual(0u, saved.Version);

        // segunda gravação com a versão certa passa; repetir a versão antiga dá 409
        var second = new UpdateClientProfileRequest { Website = "https://novo.com.br", Version = saved.Version };
        Assert.Equal(HttpStatusCode.OK, (await comercial.PutAsJsonAsync($"/api/clients/{client.Id}/profile", second, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await comercial.PutAsJsonAsync($"/api/clients/{client.Id}/profile", second, Json.Options)).StatusCode);

        // criar de novo com versão 0 quando já existe também é conflito
        Assert.Equal(HttpStatusCode.Conflict, (await comercial.PutAsJsonAsync($"/api/clients/{client.Id}/profile", new UpdateClientProfileRequest { Version = 0 }, Json.Options)).StatusCode);

        // entrada inválida e anônimo
        var invalid = new UpdateClientProfileRequest { Instagram = "nome com espaço", Version = (await comercial.GetFromJsonAsync<ClientProfileResponse>($"/api/clients/{client.Id}/profile", Json.Options))!.Version };
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await comercial.PutAsJsonAsync($"/api/clients/{client.Id}/profile", invalid, Json.Options)).StatusCode);
        using var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/clients/{client.Id}/profile")).StatusCode);
    }

    [Fact]
    public async Task First_profile_save_with_a_stale_version_is_a_conflict()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await CreateClientAsync(http);
        var response = await http.PutAsJsonAsync($"/api/clients/{client.Id}/profile", new UpdateClientProfileRequest { Version = 7 }, Json.Options);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Accesses_crud_validates_and_is_open_to_all_writing_roles()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var client = await CreateClientAsync(comercial);
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);

        Assert.Equal(HttpStatusCode.BadRequest, (await marketing.PostAsJsonAsync($"/api/clients/{client.Id}/accesses", new AccessInput { Platform = "" }, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await marketing.PostAsJsonAsync($"/api/clients/{Guid.NewGuid()}/accesses", new AccessInput { Platform = "Instagram" }, Json.Options)).StatusCode);

        var access = await ReadAsync<AccessResponse>(await marketing.PostAsJsonAsync($"/api/clients/{client.Id}/accesses", new AccessInput
        {
            Platform = "Meta Business Manager",
            AccessType = "Parceiro",
            PasswordLocation = "Não precisa de senha",
            GrantedOn = new DateOnly(2026, 10, 10),
        }, Json.Options));

        var list = await comercial.GetFromJsonAsync<List<AccessResponse>>($"/api/clients/{client.Id}/accesses", Json.Options);
        Assert.Contains(list!, a => a.Id == access.Id);

        var update = new UpdateAccessRequest { Platform = "Meta Business Manager", Account = "conta@cliente.com", Version = access.Version };
        Assert.Equal(HttpStatusCode.OK, (await comercial.PutAsJsonAsync($"/api/accesses/{access.Id}", update, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await comercial.PutAsJsonAsync($"/api/accesses/{access.Id}", update, Json.Options)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await marketing.DeleteAsync($"/api/accesses/{access.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await marketing.DeleteAsync($"/api/accesses/{access.Id}")).StatusCode);
    }

    [Fact]
    public async Task Lead_notes_appear_in_the_timeline_with_stage_changes_in_order()
    {
        var http = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await CreateLeadAsync(http);

        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput(""), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("   "), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync($"/api/leads/{Guid.NewGuid()}/notes", new LeadNoteInput("x"), Json.Options)).StatusCode);

        var first = await ReadAsync<LeadNoteResponse>(await http.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("Respondeu pedindo para falar na segunda."), Json.Options));
        Assert.Equal(HttpStatusCode.OK, (await http.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Contatado, null, lead.Version), Json.Options)).StatusCode);
        await http.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("Enviei o diagnóstico."), Json.Options);

        var timeline = (await http.GetFromJsonAsync<List<LeadTimelineItem>>($"/api/leads/{lead.Id}/timeline", Json.Options))!;
        Assert.Equal(new[] { "note", "stage", "note" }, timeline.Select(t => t.Kind).ToArray());
        Assert.Equal("Respondeu pedindo para falar na segunda.", timeline[0].Text);
        Assert.Equal(first.Id, timeline[0].NoteId);
        Assert.Equal(LeadStage.AContatar, timeline[1].From);
        Assert.Equal(LeadStage.Contatado, timeline[1].To);
        Assert.True(timeline.Zip(timeline.Skip(1)).All(p => p.First.At <= p.Second.At));

        // o histórico antigo (só etapas) continua igual
        var history = await http.GetFromJsonAsync<List<LeadStageChangeResponse>>($"/api/leads/{lead.Id}/history", Json.Options);
        Assert.Single(history!);
    }

    [Fact]
    public async Task Only_the_author_or_an_admin_deletes_a_note_and_marketing_cannot_write_notes()
    {
        var author = await factory.UserWithRoleAsync(Roles.Comercial);
        var other = await factory.UserWithRoleAsync(Roles.Comercial);
        var marketing = await factory.UserWithRoleAsync(Roles.Marketing);
        var admin = await factory.AdminAsync();
        var lead = await CreateLeadAsync(author);

        Assert.Equal(HttpStatusCode.Forbidden, (await marketing.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("Posso?"), Json.Options)).StatusCode);

        var n1 = await ReadAsync<LeadNoteResponse>(await author.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("Minha nota"), Json.Options));
        Assert.Equal(HttpStatusCode.Forbidden, (await other.DeleteAsync($"/api/lead-notes/{n1.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await marketing.DeleteAsync($"/api/lead-notes/{n1.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await author.DeleteAsync($"/api/lead-notes/{n1.Id}")).StatusCode);

        var n2 = await ReadAsync<LeadNoteResponse>(await author.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("Outra nota"), Json.Options));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/lead-notes/{n2.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/lead-notes/{n2.Id}")).StatusCode);

        // marketing lê o histórico
        Assert.Equal(HttpStatusCode.OK, (await marketing.GetAsync($"/api/leads/{lead.Id}/timeline")).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_lead_removes_its_notes()
    {
        var admin = await factory.AdminAsync();
        var lead = await CreateLeadAsync(admin);
        await admin.PostAsJsonAsync($"/api/leads/{lead.Id}/notes", new LeadNoteInput("Dado pessoal a remover"), Json.Options);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/leads/{lead.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/leads/{lead.Id}/timeline")).StatusCode);
    }
}

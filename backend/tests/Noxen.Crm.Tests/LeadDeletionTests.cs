using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Leads;
using Noxen.Crm.Api.Workspace;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Infrastructure.Messaging;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Tests;

[Collection("api")]
public class LeadDeletionTests(ApiFactory factory)
{
    private static async Task<LeadResponse> NewLeadAsync(HttpClient http) =>
        (await (await http.PostAsJsonAsync("/api/leads", new LeadInput { Company = $"Excluir {Guid.NewGuid():N}", Whatsapp = "67999990000" }, Json.Options))
            .Content.ReadFromJsonAsync<LeadResponse>(Json.Options))!;

    [Fact]
    public async Task Only_admin_can_delete_and_the_lead_history_and_links_are_handled()
    {
        var admin = await factory.AdminAsync();
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var lead = await NewLeadAsync(comercial);
        await comercial.PostAsJsonAsync($"/api/leads/{lead.Id}/stage", new ChangeStageRequest(LeadStage.Contatado, null, lead.Version), Json.Options);
        var task = await (await comercial.PostAsJsonAsync("/api/tasks", new TaskInput { Title = "Ligar", LeadId = lead.Id }, Json.Options)).Content.ReadFromJsonAsync<TaskResponse>(Json.Options);

        Assert.Equal(HttpStatusCode.Forbidden, (await comercial.DeleteAsync($"/api/leads/{lead.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().DeleteAsync($"/api/leads/{lead.Id}")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/leads/{lead.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/leads/{lead.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/leads/{lead.Id}")).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        Assert.Equal(0, await db.LeadStageChanges.CountAsync(h => h.LeadId == lead.Id));
        Assert.Null((await db.Tasks.AsNoTracking().SingleAsync(t => t.Id == task!.Id)).LeadId); // a tarefa permanece, sem o vínculo
        var events = (await db.OutboxMessages.AsNoTracking().Where(m => m.Type == EventTypes.LeadDeleted).ToListAsync());
        Assert.Contains(events, m => m.Payload.Contains(lead.Id.ToString()));
    }

    [Fact]
    public async Task A_converted_lead_cannot_be_deleted()
    {
        var admin = await factory.AdminAsync();
        var lead = await NewLeadAsync(admin);
        var converted = await admin.PostAsJsonAsync($"/api/leads/{lead.Id}/convert", new ConvertLeadRequest(1000, 500, 10, null), Json.Options);
        Assert.Equal(HttpStatusCode.Created, converted.StatusCode);

        var response = await admin.DeleteAsync($"/api/leads/{lead.Id}");
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/leads/{lead.Id}")).StatusCode);
    }
}

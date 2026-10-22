using Noxen.Crm.Domain;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Leads;

namespace Noxen.Crm.Tests;

public class LeadRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);

    private static Lead NewLead() => Lead.Create("Império Calçados", LeadSource.Instagram, null, Now);

    [Fact]
    public void New_lead_starts_in_AContatar()
    {
        Assert.Equal(LeadStage.AContatar, NewLead().Stage);
    }

    [Fact]
    public void Blank_company_is_rejected()
    {
        Assert.Throws<DomainException>(() => Lead.Create("  ", LeadSource.Evento, null, Now));
    }

    [Fact]
    public void Moving_forward_returns_previous_stage()
    {
        var lead = NewLead();
        var from = lead.MoveTo(LeadStage.Contatado, null, Now);
        Assert.Equal(LeadStage.AContatar, from);
        Assert.Equal(LeadStage.Contatado, lead.Stage);
    }

    [Fact]
    public void Lost_requires_a_reason_and_keeps_it()
    {
        var lead = NewLead();
        Assert.Throws<DomainException>(() => lead.MoveTo(LeadStage.Perdido, " ", Now));
        lead.MoveTo(LeadStage.Perdido, "Sem orçamento", Now);
        Assert.Equal("Sem orçamento", lead.LostReason);
    }

    [Fact]
    public void Lost_lead_can_only_reopen_as_AContatar_and_clears_reason()
    {
        var lead = NewLead();
        lead.MoveTo(LeadStage.Perdido, "Sem orçamento", Now);
        Assert.Throws<DomainException>(() => lead.MoveTo(LeadStage.Respondeu, null, Now));
        lead.MoveTo(LeadStage.AContatar, null, Now);
        Assert.Null(lead.LostReason);
    }

    [Fact]
    public void Closed_cannot_be_set_directly()
    {
        Assert.Throws<DomainException>(() => NewLead().MoveTo(LeadStage.Fechado, null, Now));
    }

    [Fact]
    public void Converted_lead_is_terminal()
    {
        var lead = NewLead();
        Client.ConvertFrom(lead, 5000, 1500, 10, null, DateOnly.FromDateTime(Now.UtcDateTime), Now);
        Assert.Equal(LeadStage.Fechado, lead.Stage);
        Assert.Throws<DomainException>(() => lead.MoveTo(LeadStage.Contatado, null, Now));
        Assert.Throws<DomainException>(() =>
            Client.ConvertFrom(lead, 5000, 1500, 10, null, DateOnly.FromDateTime(Now.UtcDateTime), Now));
    }

    [Fact]
    public void Lost_lead_cannot_be_converted_without_reopening()
    {
        var lead = NewLead();
        lead.MoveTo(LeadStage.Perdido, "Sem orçamento", Now);
        Assert.Throws<DomainException>(() =>
            Client.ConvertFrom(lead, 5000, 1500, 10, null, DateOnly.FromDateTime(Now.UtcDateTime), Now));
    }
}

public class ClientRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 22);

    [Theory]
    [InlineData(0)]
    [InlineData(29)]
    public void Due_day_must_be_between_1_and_28(int dueDay)
    {
        Assert.Throws<DomainException>(() => Client.Create("Loja", 4000, 1500, dueDay, Today, null, Now));
    }

    [Fact]
    public void Negative_fees_are_rejected()
    {
        Assert.Throws<DomainException>(() => Client.Create("Loja", -1, 1500, 10, Today, null, Now));
        Assert.Throws<DomainException>(() => Client.Create("Loja", 4000, -1, 10, Today, null, Now));
    }

    [Fact]
    public void Conversion_copies_lead_contact_data()
    {
        var lead = Lead.Create("Loja", LeadSource.WhatsApp, null, Now);
        lead.UpdateDetails("Loja", "Maria", "67999990000", null, "Varejo", "Campo Grande", "ms",
            LeadSource.WhatsApp, null, null, 5000, null, Now);

        var (client, previous) = Client.ConvertFrom(lead, 5000, 1500, 5, null, Today, Now);

        Assert.Equal(LeadStage.AContatar, previous);
        Assert.Equal(lead.Id, client.LeadId);
        Assert.Equal("MS", client.State);
        Assert.Equal("67999990000", client.ContactWhatsapp);
        Assert.Equal(ClientStatus.Implementacao, client.Status);
    }

    [Fact]
    public void Cnpj_is_normalized_to_digits_and_validated()
    {
        var client = Client.Create("Loja", 4000, 1500, 10, Today, null, Now);
        client.UpdateDetails("Loja", null, "11.222.333/0001-81", null, null, null, null, null, 4000, 1500, 10, null, null, null, Now);
        Assert.Equal("11222333000181", client.Cnpj);
        Assert.Throws<DomainException>(() =>
            client.UpdateDetails("Loja", null, "123", null, null, null, null, null, 4000, 1500, 10, null, null, null, Now));
    }

    [Fact]
    public void Closed_client_cannot_be_reactivated()
    {
        var client = Client.Create("Loja", 4000, 1500, 10, Today, null, Now);
        client.ChangeStatus(ClientStatus.Encerrado, Now);
        Assert.Throws<DomainException>(() => client.ChangeStatus(ClientStatus.Ativo, Now));
    }
}

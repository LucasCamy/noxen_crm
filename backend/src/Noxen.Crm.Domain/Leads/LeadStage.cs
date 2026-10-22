namespace Noxen.Crm.Domain.Leads;

public enum LeadStage
{
    AContatar = 0,
    Contatado = 1,
    Respondeu = 2,
    ReuniaoMarcada = 3,
    PropostaEnviada = 4,
    Fechado = 5,
    Perdido = 6,
}

public enum LeadSource
{
    Indicacao = 0,
    Instagram = 1,
    TikTok = 2,
    Facebook = 3,
    MetaAds = 4,
    WhatsApp = 5,
    ProspeccaoAtiva = 6,
    Evento = 7,
}

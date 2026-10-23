using System.Text.RegularExpressions;

namespace Noxen.Crm.Domain.Clients;

/// <summary>
/// Ficha de negócio e marketing do cliente (1:1 com <see cref="Client"/>): presença online, negócio e estratégia.
/// Fica separada do cliente porque muda em outro ritmo e é editada por quem cuida do marketing.
/// </summary>
public sealed partial class ClientProfile
{
    private ClientProfile() { }

    public Guid ClientId { get; private set; }

    // presença online
    public string? Website { get; private set; }
    public string? Instagram { get; private set; }
    public string? Facebook { get; private set; }
    public string? TikTok { get; private set; }

    // negócio
    public string? WhatTheySell { get; private set; }
    public string? IdealCustomer { get; private set; }
    public string? Differentiators { get; private set; }
    public string? Competitors { get; private set; }
    public string? Seasonality { get; private set; }

    // marketing
    public string? MainGoal { get; private set; }
    public string? Needs { get; private set; }
    public string? ToneOfVoice { get; private set; }
    public string? ContentPillars { get; private set; }
    public string? WhatWorked { get; private set; }
    public decimal? AdBudget { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static ClientProfile Create(Guid clientId, DateTimeOffset now) => new() { ClientId = clientId, UpdatedAt = now };

    public void Update(
        string? website, string? instagram, string? facebook, string? tikTok,
        string? whatTheySell, string? idealCustomer, string? differentiators, string? competitors, string? seasonality,
        string? mainGoal, string? needs, string? toneOfVoice, string? contentPillars, string? whatWorked, decimal? adBudget,
        DateTimeOffset now)
    {
        if (adBudget is < 0) throw new DomainException("A verba de anúncios não pode ser negativa.");

        Website = NormalizeUrl(website, "Site");
        Instagram = NormalizeInstagram(instagram);
        Facebook = NormalizeUrl(facebook, "Facebook");
        TikTok = NormalizeUrl(tikTok, "TikTok");
        WhatTheySell = Clean(whatTheySell);
        IdealCustomer = Clean(idealCustomer);
        Differentiators = Clean(differentiators);
        Competitors = Clean(competitors);
        Seasonality = Clean(seasonality);
        MainGoal = Clean(mainGoal);
        Needs = Clean(needs);
        ToneOfVoice = Clean(toneOfVoice);
        ContentPillars = Clean(contentPillars);
        WhatWorked = Clean(whatWorked);
        AdBudget = adBudget is null ? null : decimal.Round(adBudget.Value, 2);
        UpdatedAt = now;
    }

    /// <summary>Endereço web: aceita "empresa.com.br" (assume https) e recusa esquemas que não sejam http/https.</summary>
    public static string? NormalizeUrl(string? raw, string label)
    {
        var value = Clean(raw);
        if (value is null) return null;
        if (!value.Contains("://", StringComparison.Ordinal)) value = "https://" + value;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !uri.Host.Contains('.'))
            throw new DomainException($"{label}: informe um endereço válido (ex.: empresa.com.br).");
        return value.TrimEnd('/');
    }

    /// <summary>Guarda só o usuário: "@loja", "instagram.com/loja/" e "https://www.instagram.com/loja?x=1" viram "loja".</summary>
    public static string? NormalizeInstagram(string? raw)
    {
        var value = Clean(raw);
        if (value is null) return null;
        value = InstagramPrefix().Replace(value, "");
        value = value.Split('?', '#')[0].Trim('/', '@', ' ');
        if (!InstagramHandle().IsMatch(value))
            throw new DomainException("Instagram: informe o usuário (letras, números, ponto e sublinhado).");
        return value;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^(https?://)?(www\.)?instagram\.com/", RegexOptions.IgnoreCase)]
    private static partial Regex InstagramPrefix();

    [GeneratedRegex(@"^[A-Za-z0-9._]{1,30}$")]
    private static partial Regex InstagramHandle();
}

/// <summary>Acesso a uma plataforma do cliente. Registra só ONDE está a credencial, nunca a senha.</summary>
public sealed class ClientAccess
{
    private ClientAccess() { }

    public Guid Id { get; private set; }
    public Guid ClientId { get; private set; }
    public string Platform { get; private set; } = "";
    public string? Account { get; private set; }
    public string? AccessType { get; private set; }
    public string? PasswordLocation { get; private set; }
    public DateOnly? GrantedOn { get; private set; }
    public string? Note { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static ClientAccess Create(Guid clientId, string platform, string? account, string? accessType,
        string? passwordLocation, DateOnly? grantedOn, string? note, DateTimeOffset now)
    {
        var access = new ClientAccess { Id = Guid.NewGuid(), ClientId = clientId, CreatedAt = now, UpdatedAt = now };
        access.Apply(platform, account, accessType, passwordLocation, grantedOn, note);
        return access;
    }

    public void Update(string platform, string? account, string? accessType, string? passwordLocation,
        DateOnly? grantedOn, string? note, DateTimeOffset now)
    {
        Apply(platform, account, accessType, passwordLocation, grantedOn, note);
        UpdatedAt = now;
    }

    private void Apply(string platform, string? account, string? accessType, string? passwordLocation, DateOnly? grantedOn, string? note)
    {
        if (string.IsNullOrWhiteSpace(platform)) throw new DomainException("Informe a plataforma.");
        Platform = platform.Trim();
        Account = Clean(account);
        AccessType = Clean(accessType);
        PasswordLocation = Clean(passwordLocation);
        GrantedOn = grantedOn;
        Note = Clean(note);
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

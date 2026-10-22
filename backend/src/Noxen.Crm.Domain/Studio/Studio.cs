using System.Text.RegularExpressions;

namespace Noxen.Crm.Domain.Studio;

public enum StudioStatus
{
    Briefing = 0,
    EmCriacao = 1,
    Revisao = 2,
    Aprovado = 3,
    Entregue = 4,
}

public enum StudioKind
{
    Imagem = 0,
    Carrossel = 1,
    Motion = 2,
    Video = 3,
    Anuncio = 4,
    Outro = 5,
}

internal static class Rules
{
    public static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    public static string Required(string? v, string message) =>
        string.IsNullOrWhiteSpace(v) ? throw new DomainException(message) : v.Trim();

    /// <summary>Aceita só http(s) absoluto: impede esquemas como javascript: em links exibidos na interface.</summary>
    public static string? WebUrl(string? v, string message)
    {
        var url = Clean(v);
        if (url is null) return null;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new DomainException(message);
        return uri.ToString();
    }
}

/// <summary>Projeto criativo (imagem, carrossel, motion, vídeo, anúncio) com briefing e direção visual.</summary>
public sealed class StudioProject
{
    private StudioProject() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public Guid? ClientId { get; private set; }
    public StudioKind Kind { get; private set; }
    public StudioStatus Status { get; private set; }
    public string? Brief { get; private set; }
    public string? VisualDirection { get; private set; }
    public string? Storyboard { get; private set; }
    public string? Deliverables { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static StudioProject Create(string title, Guid? clientId, StudioKind kind, StudioStatus status, string? brief,
        string? visualDirection, string? storyboard, string? deliverables, DateOnly? dueDate, DateTimeOffset now)
    {
        var p = new StudioProject { Id = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now };
        p.Apply(title, clientId, kind, status, brief, visualDirection, storyboard, deliverables, dueDate);
        return p;
    }

    public void Update(string title, Guid? clientId, StudioKind kind, StudioStatus status, string? brief,
        string? visualDirection, string? storyboard, string? deliverables, DateOnly? dueDate, DateTimeOffset now)
    {
        Apply(title, clientId, kind, status, brief, visualDirection, storyboard, deliverables, dueDate);
        UpdatedAt = now;
    }

    private void Apply(string title, Guid? clientId, StudioKind kind, StudioStatus status, string? brief,
        string? visualDirection, string? storyboard, string? deliverables, DateOnly? dueDate)
    {
        if (!Enum.IsDefined(kind) || !Enum.IsDefined(status)) throw new DomainException("Tipo ou status inválido.");
        if (status is StudioStatus.EmCriacao or StudioStatus.Revisao or StudioStatus.Aprovado or StudioStatus.Entregue && Rules.Clean(brief) is null)
            throw new DomainException("Preencha o briefing antes de iniciar a criação.");
        Title = Rules.Required(title, "Informe o título do projeto.");
        ClientId = clientId;
        Kind = kind;
        Status = status;
        Brief = Rules.Clean(brief);
        VisualDirection = Rules.Clean(visualDirection);
        Storyboard = Rules.Clean(storyboard);
        Deliverables = Rules.Clean(deliverables);
        DueDate = dueDate;
    }
}

/// <summary>Kit de marca de um cliente (ou da própria agência quando sem cliente).</summary>
public sealed partial class BrandKit
{
    private BrandKit() { }

    public Guid Id { get; private set; }
    public Guid? ClientId { get; private set; }
    public string Name { get; private set; } = "";
    /// <summary>Cores em #RRGGBB separadas por vírgula.</summary>
    public string Colors { get; private set; } = "";
    public string? Fonts { get; private set; }
    public string? Tone { get; private set; }
    public string? Elements { get; private set; }
    public string? LogoUrl { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static BrandKit Create(Guid? clientId, string name, string? colors, string? fonts, string? tone, string? elements,
        string? logoUrl, DateTimeOffset now)
    {
        var k = new BrandKit { Id = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now };
        k.Apply(clientId, name, colors, fonts, tone, elements, logoUrl);
        return k;
    }

    public void Update(Guid? clientId, string name, string? colors, string? fonts, string? tone, string? elements,
        string? logoUrl, DateTimeOffset now)
    {
        Apply(clientId, name, colors, fonts, tone, elements, logoUrl);
        UpdatedAt = now;
    }

    public IReadOnlyList<string> ColorList => Colors.Length == 0 ? [] : Colors.Split(',');

    private void Apply(Guid? clientId, string name, string? colors, string? fonts, string? tone, string? elements, string? logoUrl)
    {
        Name = Rules.Required(name, "Informe o nome do kit.");
        var parsed = (colors ?? "").Split([',', ' ', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(c => c.StartsWith('#') ? c : "#" + c).ToList();
        if (parsed.Count > 12) throw new DomainException("Use no máximo 12 cores.");
        if (parsed.Any(c => !HexColor().IsMatch(c))) throw new DomainException("Cores devem estar no formato #RRGGBB.");
        ClientId = clientId;
        Colors = string.Join(',', parsed.Select(c => c.ToUpperInvariant()).Distinct());
        Fonts = Rules.Clean(fonts);
        Tone = Rules.Clean(tone);
        Elements = Rules.Clean(elements);
        LogoUrl = Rules.WebUrl(logoUrl, "O link do logo deve começar com http:// ou https://.");
    }

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex HexColor();
}

/// <summary>Referência visual (link) para consulta da equipe.</summary>
public sealed class ReferenceLink
{
    private ReferenceLink() { }

    public Guid Id { get; private set; }
    public string Title { get; private set; } = "";
    public string Url { get; private set; } = "";
    public string? Tags { get; private set; }
    public string? Note { get; private set; }
    public Guid? ClientId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public uint Version { get; private set; }

    public static ReferenceLink Create(string title, string url, string? tags, string? note, Guid? clientId, DateTimeOffset now)
    {
        var r = new ReferenceLink { Id = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now };
        r.Apply(title, url, tags, note, clientId);
        return r;
    }

    public void Update(string title, string url, string? tags, string? note, Guid? clientId, DateTimeOffset now)
    {
        Apply(title, url, tags, note, clientId);
        UpdatedAt = now;
    }

    private void Apply(string title, string url, string? tags, string? note, Guid? clientId)
    {
        Title = Rules.Required(title, "Informe o título da referência.");
        Url = Rules.WebUrl(url, "O link deve começar com http:// ou https://.") ?? throw new DomainException("Informe o link da referência.");
        Tags = Rules.Clean(tags);
        Note = Rules.Clean(note);
        ClientId = clientId;
    }
}

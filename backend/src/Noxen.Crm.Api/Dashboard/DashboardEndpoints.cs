using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Infrastructure.Caching;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Dashboard;

public sealed class PortfolioOptions
{
    public const string Section = "Portfolio";

    /// <summary>Meta de clientes ativos e prazo (padrão do negócio: 10 clientes até 30/11/2026).</summary>
    public int TargetClients { get; set; } = 10;
    public DateOnly Deadline { get; set; } = new(2026, 11, 30);
}

public sealed record PortfolioSummary(
    int ActiveClients,
    int TargetClients,
    DateOnly Deadline,
    decimal Mrr,
    Dictionary<string, int> ClientsByStatus,
    Dictionary<string, int> LeadsByStage,
    int OpenLeads,
    decimal OpenPipelineValue,
    int FollowUpsDue,
    DateTimeOffset GeneratedAt);

public static class DashboardEndpoints
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    public static void MapDashboard(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/dashboard/portfolio", GetPortfolio).WithTags("Dashboard");
    }

    /// <summary>Resumo da carteira. Fica em cache no Redis; o worker o invalida quando leads/clientes mudam.</summary>
    private static async Task<IResult> GetPortfolio(
        CrmDbContext db, IDistributedCache cache, Microsoft.Extensions.Options.IOptions<PortfolioOptions> options, TimeProvider clock)
    {
        var cached = await cache.GetStringAsync(CacheKeys.PortfolioDashboard);
        if (cached is not null && JsonSerializer.Deserialize<PortfolioSummary>(cached) is { } hit)
            return Results.Ok(hit);

        var now = clock.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var goal = options.Value;

        var clients = await db.Clients.AsNoTracking().GroupBy(c => c.Status)
            .Select(g => new { Status = g.Key, Count = g.Count(), Mrr = g.Sum(c => c.MonthlyFee) }).ToListAsync();
        var leads = await db.Leads.AsNoTracking().GroupBy(l => l.Stage)
            .Select(g => new { Stage = g.Key, Count = g.Count(), Value = g.Sum(l => l.EstimatedValue ?? 0m) }).ToListAsync();
        var followUps = await db.Leads.AsNoTracking().CountAsync(l =>
            l.NextStepDate != null && l.NextStepDate <= today &&
            l.Stage != LeadStage.Fechado && l.Stage != LeadStage.Perdido);

        var open = leads.Where(l => l.Stage is not (LeadStage.Fechado or LeadStage.Perdido)).ToList();
        var summary = new PortfolioSummary(
            ActiveClients: clients.Where(c => c.Status == ClientStatus.Ativo).Sum(c => c.Count),
            TargetClients: goal.TargetClients,
            Deadline: goal.Deadline,
            Mrr: clients.Where(c => c.Status == ClientStatus.Ativo).Sum(c => c.Mrr),
            ClientsByStatus: Enum.GetValues<ClientStatus>().ToDictionary(s => s.ToString(), s => clients.FirstOrDefault(c => c.Status == s)?.Count ?? 0),
            LeadsByStage: Enum.GetValues<LeadStage>().ToDictionary(s => s.ToString(), s => leads.FirstOrDefault(l => l.Stage == s)?.Count ?? 0),
            OpenLeads: open.Sum(l => l.Count),
            OpenPipelineValue: open.Sum(l => l.Value),
            FollowUpsDue: followUps,
            GeneratedAt: now);

        await cache.SetStringAsync(CacheKeys.PortfolioDashboard, JsonSerializer.Serialize(summary),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheTtl });
        return Results.Ok(summary);
    }
}

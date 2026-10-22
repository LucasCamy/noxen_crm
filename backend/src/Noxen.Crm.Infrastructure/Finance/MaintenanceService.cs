using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Infrastructure.Finance;

/// <summary>
/// Rotinas periódicas do Worker, todas idempotentes: gera as mensalidades do mês corrente e apaga da outbox
/// as mensagens já publicadas há mais de 7 dias.
/// </summary>
public sealed class MaintenanceService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<MaintenanceService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    public static readonly TimeSpan OutboxRetention = TimeSpan.FromDays(7);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Falha nas rotinas de manutenção; nova tentativa na próxima hora.");
            }
        }
        while (await WaitAsync(timer, stoppingToken));
    }

    /// <summary>Executa as rotinas uma vez. Exposto para testes.</summary>
    public async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var now = clock.GetUtcNow();

        var generator = scope.ServiceProvider.GetRequiredService<ChargeGenerator>();
        var created = await generator.GenerateAsync(DateOnly.FromDateTime(now.UtcDateTime), ct);
        if (created > 0) logger.LogInformation("Geradas {Count} mensalidades do mês.", created);

        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var cutoff = now - OutboxRetention;
        var removed = await db.OutboxMessages.Where(m => m.ProcessedAt != null && m.ProcessedAt < cutoff).ExecuteDeleteAsync(ct);
        if (removed > 0) logger.LogInformation("Removidas {Count} mensagens antigas da outbox.", removed);
    }

    private static async Task<bool> WaitAsync(PeriodicTimer timer, CancellationToken ct)
    {
        try
        {
            return await timer.WaitForNextTickAsync(ct);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}

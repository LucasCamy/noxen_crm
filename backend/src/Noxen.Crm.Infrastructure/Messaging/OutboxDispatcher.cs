using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Noxen.Crm.Infrastructure.Persistence;
using RabbitMQ.Client;

namespace Noxen.Crm.Infrastructure.Messaging;

/// <summary>
/// Publica no RabbitMQ os eventos pendentes da tabela outbox. Entrega pelo menos uma vez: se o processo
/// cair depois do confirm e antes do commit, o evento é republicado, então os consumidores precisam ser idempotentes.
/// Várias instâncias podem rodar juntas (FOR UPDATE SKIP LOCKED), sem ordem global garantida.
/// </summary>
public sealed class OutboxDispatcher(
    IServiceScopeFactory scopes,
    RabbitMqConnection rabbit,
    TimeProvider clock,
    ILogger<OutboxDispatcher> logger) : BackgroundService
{
    private const int BatchSize = 50;
    private const int MaxAttempts = 10;
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan ErrorDelay = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var connection = await rabbit.GetAsync(stoppingToken);
                await using var channel = await connection.CreateChannelAsync(
                    new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
                    stoppingToken);
                await RabbitTopology.DeclareAsync(channel, stoppingToken);

                while (!stoppingToken.IsCancellationRequested)
                {
                    var published = await DispatchBatchAsync(channel, stoppingToken);
                    if (published == 0) await Task.Delay(IdleDelay, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha no dispatcher da outbox; nova tentativa em {Delay}s.", ErrorDelay.TotalSeconds);
                await Task.Delay(ErrorDelay, stoppingToken);
            }
        }
    }

    /// <summary>Publica um lote e devolve quantas mensagens foram publicadas. Exposto para testes.</summary>
    public async Task<int> DispatchBatchAsync(IChannel channel, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var batch = await db.OutboxMessages
            .FromSql($"""
                SELECT * FROM outbox_messages
                WHERE "ProcessedAt" IS NULL AND "Attempts" < {MaxAttempts}
                ORDER BY "OccurredAt"
                LIMIT {BatchSize}
                FOR UPDATE SKIP LOCKED
                """)
            .ToListAsync(ct);

        var published = 0;
        foreach (var message in batch)
        {
            try
            {
                var props = new BasicProperties
                {
                    Persistent = true,
                    MessageId = message.Id.ToString(),
                    Type = message.Type,
                    ContentType = "application/json",
                    Timestamp = new AmqpTimestamp(message.OccurredAt.ToUnixTimeSeconds()),
                };
                await channel.BasicPublishAsync(RabbitTopology.Exchange, message.Type, false, props,
                    Encoding.UTF8.GetBytes(message.Payload), ct);
                message.MarkProcessed(clock.GetUtcNow());
                published++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Falha ao publicar a mensagem {MessageId} ({Type}).", message.Id, message.Type);
                message.MarkFailed(ex.Message);
                break; // preserva a ordem do lote; o canal pode estar inválido
            }
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return published;
    }
}

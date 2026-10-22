using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Noxen.Crm.Infrastructure.Caching;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Noxen.Crm.Infrastructure.Messaging;

/// <summary>
/// Invalida o cache do painel da carteira quando um lead ou cliente muda. Remover a chave é idempotente,
/// então a entrega repetida é inofensiva. Falhas vão para a fila crm.dead-letter.
/// </summary>
public sealed class DashboardCacheInvalidationConsumer(
    RabbitMqConnection rabbit,
    IDistributedCache cache,
    ILogger<DashboardCacheInvalidationConsumer> logger) : BackgroundService
{
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var connection = await rabbit.GetAsync(stoppingToken);
                await using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);
                await RabbitTopology.DeclareAsync(channel, stoppingToken);
                await channel.BasicQosAsync(0, 10, false, stoppingToken);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += async (_, ea) =>
                {
                    try
                    {
                        await cache.RemoveAsync(CacheKeys.PortfolioDashboard, stoppingToken);
                        await channel.BasicAckAsync(ea.DeliveryTag, false, stoppingToken);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        logger.LogError(ex, "Falha ao invalidar o cache ({RoutingKey}); enviando para a dead-letter.", ea.RoutingKey);
                        await channel.BasicNackAsync(ea.DeliveryTag, false, requeue: false, stoppingToken);
                    }
                };
                await channel.BasicConsumeAsync(RabbitTopology.DashboardQueue, autoAck: false, consumer, stoppingToken);

                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Consumidor do painel indisponível; nova tentativa em {Delay}s.", RetryDelay.TotalSeconds);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }
    }
}

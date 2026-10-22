using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Noxen.Crm.Infrastructure;
using Noxen.Crm.Infrastructure.Caching;
using Noxen.Crm.Infrastructure.Messaging;
using Noxen.Crm.Infrastructure.Persistence;
using RabbitMQ.Client;
using Testcontainers.PostgreSql;
using Testcontainers.RabbitMq;
using Testcontainers.Redis;

namespace Noxen.Crm.Tests;

/// <summary>
/// Fluxo completo do Worker com containers reais: evento na outbox (PostgreSQL) → publicação no RabbitMQ →
/// consumo → invalidação da chave no Redis.
/// </summary>
public class MessagingPipelineTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
    private readonly RabbitMqContainer _rabbit = new RabbitMqBuilder("rabbitmq:4-alpine").Build();
    private readonly RedisContainer _redis = new RedisBuilder("redis:7-alpine").Build();

    public Task InitializeAsync() => Task.WhenAll(_postgres.StartAsync(), _rabbit.StartAsync(), _redis.StartAsync());

    public async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await _rabbit.DisposeAsync();
        await _redis.DisposeAsync();
    }

    private IHost BuildWorkerHost()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = _postgres.GetConnectionString(),
            ["ConnectionStrings:Redis"] = _redis.GetConnectionString(),
            ["RabbitMq:Host"] = _rabbit.Hostname,
            ["RabbitMq:Port"] = _rabbit.GetMappedPublicPort(5672).ToString(),
            ["RabbitMq:User"] = "rabbitmq",
            ["RabbitMq:Password"] = "rabbitmq",
        }).Build();

        // Mesma composição de src/Noxen.Crm.Worker/Program.cs.
        var builder = Host.CreateApplicationBuilder();
        builder.Configuration.AddConfiguration(config);
        builder.Services.AddCrmInfrastructure(builder.Configuration);
        builder.Services.AddCrmRabbitMq(builder.Configuration);
        builder.Services.AddHostedService<OutboxDispatcher>();
        builder.Services.AddHostedService<DashboardCacheInvalidationConsumer>();
        return builder.Build();
    }

    private static async Task<bool> WaitUntilAsync(Func<Task<bool>> condition, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (await condition()) return true;
            await Task.Delay(250);
        }
        return await condition();
    }

    [Fact]
    public async Task Outbox_event_is_published_consumed_and_invalidates_the_redis_cache()
    {
        using var host = BuildWorkerHost();
        await using (var scope = host.Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<CrmDbContext>().Database.MigrateAsync();

        var cache = host.Services.GetRequiredService<IDistributedCache>();
        await cache.SetStringAsync(CacheKeys.PortfolioDashboard, "{\"valor\":\"antigo\"}");

        Guid messageId;
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            db.AddEvent(EventTypes.LeadStageChanged, new LeadStageChangedEvent(Guid.NewGuid(), "AContatar", "Contatado"), DateTimeOffset.UtcNow);
            await db.SaveChangesAsync();
            messageId = (await db.OutboxMessages.SingleAsync()).Id;
        }

        await host.StartAsync();
        try
        {
            var invalidated = await WaitUntilAsync(async () => await cache.GetStringAsync(CacheKeys.PortfolioDashboard) is null, TimeSpan.FromSeconds(30));
            Assert.True(invalidated, "O consumidor não invalidou o cache no Redis a tempo.");

            await using var scope = host.Services.CreateAsyncScope();
            var processed = await scope.ServiceProvider.GetRequiredService<CrmDbContext>().OutboxMessages
                .AsNoTracking().SingleAsync(m => m.Id == messageId);
            Assert.NotNull(processed.ProcessedAt);
            Assert.Equal(0, processed.Attempts);
        }
        finally
        {
            await host.StopAsync();
        }
    }

    [Fact]
    public async Task Dispatcher_publishes_each_pending_message_once_and_leaves_processed_ones_alone()
    {
        using var host = BuildWorkerHost();
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            await db.Database.MigrateAsync();
            for (var i = 0; i < 3; i++)
                db.AddEvent(EventTypes.ClientChanged, new ClientChangedEvent(Guid.NewGuid(), "updated"), DateTimeOffset.UtcNow);
            await db.SaveChangesAsync();
        }

        var dispatcher = host.Services.GetServices<IHostedService>().OfType<OutboxDispatcher>().Single();
        var rabbit = host.Services.GetRequiredService<RabbitMqConnection>();
        var connection = await rabbit.GetAsync(CancellationToken.None);
        await using var channel = await connection.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true));
        await RabbitTopology.DeclareAsync(channel, CancellationToken.None);

        Assert.Equal(3, await dispatcher.DispatchBatchAsync(channel, CancellationToken.None));
        Assert.Equal(0, await dispatcher.DispatchBatchAsync(channel, CancellationToken.None));

        var queued = await channel.QueueDeclarePassiveAsync(RabbitTopology.DashboardQueue);
        Assert.Equal(3u, queued.MessageCount);
    }
}

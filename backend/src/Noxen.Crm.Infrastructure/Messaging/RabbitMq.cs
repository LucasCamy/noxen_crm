using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace Noxen.Crm.Infrastructure.Messaging;

public sealed class RabbitMqOptions
{
    public const string Section = "RabbitMq";

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    public string VirtualHost { get; set; } = "/";
}

public static class RabbitTopology
{
    public const string Exchange = "noxen.crm.events";
    public const string DeadLetterExchange = "noxen.crm.events.dlx";
    public const string DeadLetterQueue = "crm.dead-letter";
    public const string DashboardQueue = "crm.dashboard-cache";

    /// <summary>Declaração idempotente; chamada por quem publica e por quem consome.</summary>
    public static async Task DeclareAsync(IChannel channel, CancellationToken ct)
    {
        await channel.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, cancellationToken: ct);
        await channel.ExchangeDeclareAsync(DeadLetterExchange, ExchangeType.Fanout, durable: true, cancellationToken: ct);
        await channel.QueueDeclareAsync(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false, cancellationToken: ct);
        await channel.QueueBindAsync(DeadLetterQueue, DeadLetterExchange, "", cancellationToken: ct);

        var args = new Dictionary<string, object?> { ["x-dead-letter-exchange"] = DeadLetterExchange };
        await channel.QueueDeclareAsync(DashboardQueue, durable: true, exclusive: false, autoDelete: false, args, cancellationToken: ct);
        await channel.QueueBindAsync(DashboardQueue, Exchange, "lead.#", cancellationToken: ct);
        await channel.QueueBindAsync(DashboardQueue, Exchange, "client.#", cancellationToken: ct);
    }
}

/// <summary>Conexão única e preguiçosa com o broker (a recuperação automática do cliente cuida de quedas).</summary>
public sealed class RabbitMqConnection(IOptions<RabbitMqOptions> options) : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IConnection? _connection;

    public async Task<IConnection> GetAsync(CancellationToken ct)
    {
        if (_connection is { IsOpen: true }) return _connection;

        await _gate.WaitAsync(ct);
        try
        {
            if (_connection is { IsOpen: true }) return _connection;
            var o = options.Value;
            var factory = new ConnectionFactory
            {
                HostName = o.Host,
                Port = o.Port,
                UserName = o.User,
                Password = o.Password,
                VirtualHost = o.VirtualHost,
                ClientProvidedName = "noxen-crm",
            };
            _connection = await factory.CreateConnectionAsync(ct);
            return _connection;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null) await _connection.DisposeAsync();
        _gate.Dispose();
    }
}

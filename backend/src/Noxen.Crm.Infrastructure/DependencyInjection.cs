using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Noxen.Crm.Infrastructure.Messaging;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Infrastructure;

public static class DependencyInjection
{
    /// <summary>PostgreSQL, Redis (cache distribuído) e relógio. Connection strings: Postgres e Redis.</summary>
    public static IServiceCollection AddCrmInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var postgres = config.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres não configurada.");
        var redis = config.GetConnectionString("Redis")
            ?? throw new InvalidOperationException("ConnectionStrings:Redis não configurada.");

        services.AddDbContext<CrmDbContext>(o => o.UseNpgsql(postgres));
        services.AddStackExchangeRedisCache(o =>
        {
            o.Configuration = redis;
            o.InstanceName = "noxen-crm:";
        });
        services.AddSingleton(TimeProvider.System);
        return services;
    }

    public static IServiceCollection AddCrmRabbitMq(this IServiceCollection services, IConfiguration config)
    {
        services.AddOptions<RabbitMqOptions>().Bind(config.GetSection(RabbitMqOptions.Section))
            .Validate(o => !string.IsNullOrWhiteSpace(o.User) && !string.IsNullOrWhiteSpace(o.Password),
                "RabbitMq:User e RabbitMq:Password são obrigatórios.")
            .ValidateOnStart();
        services.AddSingleton<RabbitMqConnection>();
        return services;
    }
}

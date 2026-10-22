using Noxen.Crm.Infrastructure;
using Noxen.Crm.Infrastructure.Finance;
using Noxen.Crm.Infrastructure.Messaging;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddCrmInfrastructure(builder.Configuration);
builder.Services.AddCrmRabbitMq(builder.Configuration);
builder.Services.AddHostedService<OutboxDispatcher>();
builder.Services.AddHostedService<DashboardCacheInvalidationConsumer>();
builder.Services.AddHostedService<MaintenanceService>();

await builder.Build().RunAsync();

using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Api.Clients;
using Noxen.Crm.Api.Common;
using Noxen.Crm.Api.Dashboard;
using Noxen.Crm.Api.Finance;
using Noxen.Crm.Api.Leads;
using Noxen.Crm.Infrastructure;
using Noxen.Crm.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.Services.AddCrmInfrastructure(config);
builder.Services.AddCrmAuth(config);
builder.Services.Configure<PortfolioOptions>(config.GetSection(PortfolioOptions.Section));
builder.Services.Configure<AdminSeedOptions>(config.GetSection(AdminSeedOptions.Section));

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddValidation();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddDbContextCheck<CrmDbContext>("postgres", tags: ["ready"]);

var allowedOrigins = config.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (allowedOrigins.Length > 0) p.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
}));

// Limite por IP nas rotas de autenticação. Atrás de proxy, configure ForwardedHeaders para o IP real.
var authPerMinute = config.GetValue("RateLimit:AuthPerMinute", 10);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = authPerMinute, Window = TimeSpan.FromMinutes(1) }));
});

// Atrás de um proxy reverso (nginx do frontend) o IP real vem em X-Forwarded-For. Só habilite quando a API
// NÃO estiver exposta diretamente: com isso o cabeçalho passa a ser confiável de qualquer origem.
if (config.GetValue<bool>("ForwardedHeaders:Enabled"))
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        o.KnownIPNetworks.Clear();
        o.KnownProxies.Clear();
    });

var app = builder.Build();

if (config.GetValue<bool>("Database:MigrateOnStartup"))
    await using (var scope = app.Services.CreateAsyncScope())
        await scope.ServiceProvider.GetRequiredService<CrmDbContext>().Database.MigrateAsync();
await DatabaseSeeder.SeedAsync(app.Services);

if (config.GetValue<bool>("ForwardedHeaders:Enabled")) app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment()) app.MapOpenApi().AllowAnonymous();

app.MapHealthChecks("/health/live", new() { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") }).AllowAnonymous();

app.MapAuth();
app.MapUsers();
app.MapLeads();
app.MapClients();
app.MapDashboard();
app.MapFinance();
app.MapClientActivities();

app.Run();

public partial class Program;

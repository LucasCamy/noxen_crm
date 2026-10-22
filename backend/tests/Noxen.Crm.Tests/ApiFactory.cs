using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Domain.Identity;
using Testcontainers.PostgreSql;

namespace Noxen.Crm.Tests;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };
}

public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "admin@teste.local";
    public const string AdminPassword = "Admin-teste-12345";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine").Build();
    private readonly Dictionary<string, string?> _previousEnv = new();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        // Variáveis de ambiente chegam antes de qualquer leitura eager de configuração no Program.
        SetEnv("ConnectionStrings__Postgres", _postgres.GetConnectionString());
        SetEnv("ConnectionStrings__Redis", "localhost:6379"); // substituído por cache em memória abaixo
        SetEnv("Jwt__Key", "chave-de-teste-com-mais-de-trinta-e-dois-caracteres");
        SetEnv("Database__MigrateOnStartup", "true");
        SetEnv("AdminSeed__Email", AdminEmail);
        SetEnv("AdminSeed__Password", AdminPassword);
        SetEnv("RateLimit__AuthPerMinute", "10000");
    }

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IDistributedCache>();
            services.AddDistributedMemoryCache();
        });
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
        foreach (var (key, value) in _previousEnv) Environment.SetEnvironmentVariable(key, value);
    }

    private void SetEnv(string key, string value)
    {
        _previousEnv[key] = Environment.GetEnvironmentVariable(key);
        Environment.SetEnvironmentVariable(key, value);
    }

    public async Task<HttpClient> LoginAsync(string email, string password)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password), Json.Options);
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(Json.Options))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    public Task<HttpClient> AdminAsync() => LoginAsync(AdminEmail, AdminPassword);

    /// <summary>Cria (via API, como Admin) um usuário com o papel e devolve um cliente HTTP autenticado como ele.</summary>
    public async Task<HttpClient> UserWithRoleAsync(string role)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@teste.local";
        const string password = "Senha-teste-12345";
        var admin = await AdminAsync();
        var created = await admin.PostAsJsonAsync("/api/users", new CreateUserRequest(email, $"Usuário {role}", password, role), Json.Options);
        created.EnsureSuccessStatusCode();
        return await LoginAsync(email, password);
    }

    public Task ClearCacheAsync() =>
        Services.GetRequiredService<IDistributedCache>().RemoveAsync(Noxen.Crm.Infrastructure.Caching.CacheKeys.PortfolioDashboard);
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;

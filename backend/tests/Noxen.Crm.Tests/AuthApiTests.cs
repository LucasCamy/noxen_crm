using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Noxen.Crm.Api.Auth;
using Noxen.Crm.Domain.Identity;

namespace Noxen.Crm.Tests;

[Collection("api")]
public class AuthApiTests(ApiFactory factory)
{
    [Fact]
    public async Task Protected_endpoints_require_authentication()
    {
        var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/leads")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/dashboard/portfolio")).StatusCode);
    }

    [Fact]
    public async Task Health_endpoints_are_public()
    {
        var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health/live")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health/ready")).StatusCode);
    }

    [Fact]
    public async Task Login_with_wrong_password_is_unauthorized_and_generic()
    {
        var client = factory.CreateClient();
        var wrongPassword = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(ApiFactory.AdminEmail, "senha-errada"));
        var unknownUser = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("ninguem@teste.local", "senha-errada"));

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownUser.StatusCode);
        // Mesma resposta nos dois casos (exceto o traceId): a API não revela se o e-mail existe.
        var a = await wrongPassword.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        var b = await unknownUser.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        Assert.Equal(a!.Title, b!.Title);
        Assert.Equal(a.Status, b.Status);
    }

    [Fact]
    public async Task Account_is_locked_after_repeated_failures()
    {
        var admin = await factory.AdminAsync();
        var email = $"lock-{Guid.NewGuid():N}@teste.local";
        (await admin.PostAsJsonAsync("/api/users", new CreateUserRequest(email, "Bloqueio", "Senha-teste-12345", Roles.Marketing), Json.Options))
            .EnsureSuccessStatusCode();

        var client = factory.CreateClient();
        for (var i = 0; i < 5; i++)
            await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "errada"));

        var correctButLocked = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "Senha-teste-12345"));
        Assert.Equal(HttpStatusCode.Locked, correctButLocked.StatusCode);
    }

    [Fact]
    public async Task Refresh_rotates_the_token_and_reuse_revokes_the_session()
    {
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(ApiFactory.AdminEmail, ApiFactory.AdminPassword));
        var first = (await login.Content.ReadFromJsonAsync<AuthResponse>(Json.Options))!;

        var refreshed = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        var second = (await refreshed.Content.ReadFromJsonAsync<AuthResponse>(Json.Options))!;
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);

        // Reaproveitar o token antigo é tratado como roubo: nega e derruba também o token novo.
        var reuse = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        var afterReuse = await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(second.RefreshToken));
        Assert.Equal(HttpStatusCode.Unauthorized, afterReuse.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(ApiFactory.AdminEmail, ApiFactory.AdminPassword));
        var auth = (await login.Content.ReadFromJsonAsync<AuthResponse>(Json.Options))!;

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/logout", new RefreshRequest(auth.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(auth.RefreshToken))).StatusCode);
    }

    [Fact]
    public async Task Me_returns_the_authenticated_user_and_roles()
    {
        var admin = await factory.AdminAsync();
        var me = await admin.GetFromJsonAsync<UserInfo>("/api/auth/me", Json.Options);
        Assert.Equal(ApiFactory.AdminEmail, me!.Email);
        Assert.Contains(Roles.Admin, me.Roles);
    }

    [Fact]
    public async Task Only_admin_can_manage_users()
    {
        var comercial = await factory.UserWithRoleAsync(Roles.Comercial);
        var body = new CreateUserRequest($"x-{Guid.NewGuid():N}@teste.local", "Novo", "Senha-teste-12345", Roles.Marketing);

        Assert.Equal(HttpStatusCode.Forbidden, (await comercial.PostAsJsonAsync("/api/users", body, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await comercial.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await comercial.GetAsync("/api/users/lookup")).StatusCode);
    }

    [Fact]
    public async Task Weak_password_and_invalid_role_are_rejected()
    {
        var admin = await factory.AdminAsync();
        var weak = await admin.PostAsJsonAsync("/api/users",
            new CreateUserRequest($"w-{Guid.NewGuid():N}@teste.local", "Fraco", "curta", Roles.Marketing), Json.Options);
        var badRole = await admin.PostAsJsonAsync("/api/users",
            new CreateUserRequest($"r-{Guid.NewGuid():N}@teste.local", "Papel", "Senha-teste-12345", "Root"), Json.Options);

        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, badRole.StatusCode);
    }

    [Fact]
    public async Task Deactivated_user_cannot_log_in_or_refresh()
    {
        var admin = await factory.AdminAsync();
        var email = $"off-{Guid.NewGuid():N}@teste.local";
        var created = await admin.PostAsJsonAsync("/api/users", new CreateUserRequest(email, "Saindo", "Senha-teste-12345", Roles.Marketing), Json.Options);
        var user = (await created.Content.ReadFromJsonAsync<UserSummary>(Json.Options))!;

        var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "Senha-teste-12345"));
        var auth = (await login.Content.ReadFromJsonAsync<AuthResponse>(Json.Options))!;

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/users/{user.Id}/deactivate", null)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(auth.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "Senha-teste-12345"))).StatusCode);
    }

    [Fact]
    public async Task Tampered_token_is_rejected()
    {
        var admin = await factory.AdminAsync();
        var token = admin.DefaultRequestHeaders.Authorization!.Parameter!;
        var tampered = token[..^3] + (token[^3] == 'A' ? "BBB" : "AAA");

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tampered);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/leads")).StatusCode);
    }
}

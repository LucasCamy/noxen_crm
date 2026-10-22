using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Auth;

public sealed record LoginRequest([Required, EmailAddress, MaxLength(256)] string Email, [Required, MaxLength(256)] string Password);
public sealed record RefreshRequest([Required, MaxLength(200)] string RefreshToken);
public sealed record UserInfo(Guid Id, string Email, string FullName, string[] Roles);
public sealed record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, string RefreshToken, UserInfo User);

public static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth").RequireRateLimiting("auth");

        group.MapPost("/login", Login).AllowAnonymous();
        group.MapPost("/refresh", Refresh).AllowAnonymous();
        group.MapPost("/logout", Logout).AllowAnonymous();
        app.MapGet("/api/auth/me", Me).WithTags("Auth");
    }

    private static async Task<IResult> Login(
        LoginRequest req, UserManager<ApplicationUser> users, TokenService tokens, CrmDbContext db)
    {
        var invalid = Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "E-mail ou senha inválidos.");

        var user = await users.FindByEmailAsync(req.Email);
        if (user is null || !user.IsActive) return invalid;
        if (await users.IsLockedOutAsync(user))
            return Results.Problem(statusCode: StatusCodes.Status423Locked, title: "Conta bloqueada temporariamente por tentativas inválidas.");

        if (!await users.CheckPasswordAsync(user, req.Password))
        {
            await users.AccessFailedAsync(user);
            return invalid;
        }

        await users.ResetAccessFailedCountAsync(user);
        var response = await IssueAsync(user, users, tokens, db);
        return Results.Ok(response);
    }

    private static async Task<IResult> Refresh(
        RefreshRequest req, UserManager<ApplicationUser> users, TokenService tokens, CrmDbContext db, TimeProvider clock)
    {
        var unauthorized = Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Refresh token inválido.");
        var hash = TokenService.Hash(req.RefreshToken);
        var stored = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash);
        if (stored is null) return unauthorized;

        var now = clock.GetUtcNow();
        if (stored.RevokedAt is not null)
        {
            // Reuso de token já rotacionado: possível vazamento; encerra todas as sessões do usuário.
            await db.RefreshTokens.Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
            return unauthorized;
        }
        if (stored.ExpiresAt <= now) return unauthorized;

        var user = await users.FindByIdAsync(stored.UserId.ToString());
        if (user is null || !user.IsActive) return unauthorized;

        // Revogação atômica: de duas requisições simultâneas com o mesmo token, só uma consegue rotacioná-lo.
        var revoked = await db.RefreshTokens.Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
        if (revoked == 0) return unauthorized;

        var response = await IssueAsync(user, users, tokens, db);
        return Results.Ok(response);
    }

    private static async Task<IResult> Logout(RefreshRequest req, CrmDbContext db, TimeProvider clock)
    {
        var hash = TokenService.Hash(req.RefreshToken);
        var now = clock.GetUtcNow();
        await db.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
        return Results.NoContent();
    }

    private static IResult Me(System.Security.Claims.ClaimsPrincipal principal)
    {
        var id = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        return Guid.TryParse(id, out var userId)
            ? Results.Ok(new UserInfo(
                userId,
                principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value ?? "",
                principal.FindFirst(JwtRegisteredClaimNames.Name)?.Value ?? "",
                principal.FindAll("role").Select(c => c.Value).ToArray()))
            : Results.Unauthorized();
    }

    private static async Task<AuthResponse> IssueAsync(
        ApplicationUser user, UserManager<ApplicationUser> users, TokenService tokens, CrmDbContext db)
    {
        var roles = (await users.GetRolesAsync(user)).ToArray();
        var (access, expires) = tokens.CreateAccessToken(user, roles);
        var refresh = tokens.CreateRefreshToken(user.Id);
        await db.SaveChangesAsync();
        return new AuthResponse(access, expires, refresh, new UserInfo(user.Id, user.Email ?? "", user.FullName, roles));
    }
}

public sealed record CreateUserRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(150)] string FullName,
    [Required, MaxLength(256)] string Password,
    [Required] string Role);

public sealed record UserSummary(Guid Id, string Email, string FullName, bool IsActive, string[] Roles);
public sealed record UserLookup(Guid Id, string FullName);

public static class UserEndpoints
{
    public static void MapUsers(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users");

        group.MapGet("/lookup", async (CrmDbContext db) =>
            Results.Ok(await db.Users.AsNoTracking().Where(u => u.IsActive).OrderBy(u => u.FullName)
                .Select(u => new UserLookup(u.Id, u.FullName)).ToListAsync()));

        group.MapGet("/", async (UserManager<ApplicationUser> users, CrmDbContext db) =>
        {
            var list = await db.Users.AsNoTracking().OrderBy(u => u.FullName).ToListAsync();
            var result = new List<UserSummary>();
            foreach (var u in list)
                result.Add(new UserSummary(u.Id, u.Email ?? "", u.FullName, u.IsActive, (await users.GetRolesAsync(u)).ToArray()));
            return Results.Ok(result);
        }).RequireAuthorization(Policies.AdminOnly);

        group.MapPost("/", async (CreateUserRequest req, UserManager<ApplicationUser> users) =>
        {
            if (!Roles.All.Contains(req.Role))
                return Results.Problem(statusCode: 400, title: $"Papel inválido. Use: {string.Join(", ", Roles.All)}.");

            var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = req.Email, Email = req.Email, FullName = req.FullName.Trim() };
            var created = await users.CreateAsync(user, req.Password);
            if (!created.Succeeded)
                return Results.ValidationProblem(created.Errors.GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));

            await users.AddToRoleAsync(user, req.Role);
            return Results.Created($"/api/users/{user.Id}", new UserSummary(user.Id, req.Email, user.FullName, true, [req.Role]));
        }).RequireAuthorization(Policies.AdminOnly);

        group.MapPost("/{id:guid}/deactivate", async (Guid id, System.Security.Claims.ClaimsPrincipal me, CrmDbContext db, TimeProvider clock) =>
        {
            if (me.GetUserId() == id) return Results.Problem(statusCode: 422, title: "Você não pode desativar a própria conta.");
            var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id);
            if (user is null) return Results.NotFound();
            user.IsActive = false;
            var now = clock.GetUtcNow();
            await db.RefreshTokens.Where(t => t.UserId == id && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(Policies.AdminOnly);
    }
}

public static class PrincipalExtensions
{
    public static Guid? GetUserId(this System.Security.Claims.ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id) ? id : null;
}

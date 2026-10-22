using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Noxen.Crm.Domain.Identity;
using Noxen.Crm.Infrastructure.Persistence;

namespace Noxen.Crm.Api.Auth;

public sealed class AdminSeedOptions
{
    public const string Section = "AdminSeed";

    public string? Email { get; set; }
    public string? Password { get; set; }
    public string FullName { get; set; } = "Administrador";
}

public static class DatabaseSeeder
{
    /// <summary>
    /// Garante os papéis e, se AdminSeed estiver configurado e ainda não houver usuários, cria o primeiro Admin.
    /// Não existe senha padrão: sem AdminSeed:Password nenhum usuário é criado.
    /// </summary>
    public static async Task SeedAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in Roles.All)
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.NewGuid() });

        var seed = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedOptions>>().Value;
        if (string.IsNullOrWhiteSpace(seed.Email) || string.IsNullOrWhiteSpace(seed.Password)) return;

        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (users.Users.Any()) return;

        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = seed.Email, Email = seed.Email, EmailConfirmed = true, FullName = seed.FullName,
        };
        var created = await users.CreateAsync(admin, seed.Password);
        if (!created.Succeeded)
            throw new InvalidOperationException("Falha ao criar o Admin inicial: " + string.Join("; ", created.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(admin, Roles.Admin);
    }
}

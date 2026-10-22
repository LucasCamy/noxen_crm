namespace Noxen.Crm.Domain.Identity;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Comercial = "Comercial";
    public const string Marketing = "Marketing";

    public static readonly string[] All = [Admin, Comercial, Marketing];
}

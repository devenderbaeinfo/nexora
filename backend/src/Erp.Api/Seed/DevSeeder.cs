using Erp.Domain.Identity;
using Erp.Domain.Tenancy;
using Erp.Infrastructure.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Seed;

// Dev/demo convenience only — never runs against a populated database (see the guard below).
// Seeds exactly one thing: the platform tenant and its single SuperAdmin account. Everything
// else (client tenants, their Admins, HR/Manager/Finance/Employee accounts, departments,
// projects, leave policy) is created for real through the provisioning APIs from here on —
// PlatformController for a new tenant + its Admin, then UsersController for everyone else.
public static class DevSeeder
{
    private const string SuperAdminEmail = "sadmin@gmail.com";
    private const string SuperAdminPassword = "ChangeMe!2026x";

    public static async Task SeedIfEmptyAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        if (await db.Tenants.IgnoreQueryFilters().AnyAsync()) return;

        var platformTenant = new Tenant { Name = "Platform", Slug = "platform" };
        db.Tenants.Add(platformTenant);
        await db.SaveChangesAsync();

        var superAdminRole = await TenantRoleStore.EnsureRoleAsync(db, platformTenant.Id, RoleTemplates.SuperAdmin);
        foreach (var perm in RoleTemplates.PermissionsFor(RoleTemplates.SuperAdmin))
        {
            db.RolePermissions.Add(new RolePermission { TenantId = platformTenant.Id, RoleId = superAdminRole.Id, PermissionKey = perm });
        }
        await db.SaveChangesAsync();

        var superAdminUser = new AppUser
        {
            TenantId = platformTenant.Id,
            UserName = SuperAdminEmail,
            Email = SuperAdminEmail,
            EmailConfirmed = true,
        };
        await userManager.CreateAsync(superAdminUser, SuperAdminPassword);
        await TenantRoleStore.AssignRoleAsync(db, platformTenant.Id, superAdminUser.Id, RoleTemplates.SuperAdmin);
    }
}

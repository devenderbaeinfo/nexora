using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Seed;

// RolePermissions rows are written once, at tenant-provisioning time (PlatformController),
// from whatever RoleTemplates.PermissionsFor(role) returned that day. Every time a new
// module ships a new Permission.* constant, every tenant created before that day is
// silently missing it — the code says HR can manage Onboarding, but the DB row never
// got the "onboarding.manage" string. This closes that gap on every startup: additive
// only (never removes a key), so nothing existing is ever taken away.
public static class RolePermissionSync
{
    private static readonly string[] KnownRoles =
    [
        RoleTemplates.SuperAdmin, RoleTemplates.Admin, RoleTemplates.Hr,
        RoleTemplates.Manager, RoleTemplates.Finance, RoleTemplates.Employee,
    ];

    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ErpDbContext>();

        // Custom, tenant-created roles and any role an Admin has hand-edited are never
        // touched here — only the untouched, out-of-the-box system roles get topped up
        // with newly shipped permissions.
        var roles = (await db.Roles.IgnoreQueryFilters().ToListAsync())
            .Where(r => KnownRoles.Contains(r.Name!) && !r.IsCustomized)
            .ToList();

        var existingKeysByRole = await db.RolePermissions.IgnoreQueryFilters()
            .GroupBy(rp => rp.RoleId)
            .Select(g => new { RoleId = g.Key, Keys = g.Select(rp => rp.PermissionKey).ToList() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Keys.ToHashSet());

        foreach (var role in roles)
        {
            var existing = existingKeysByRole.GetValueOrDefault(role.Id, []);
            var desired = RoleTemplates.PermissionsFor(role.Name!);

            foreach (var key in desired)
            {
                if (existing.Contains(key)) continue;
                db.RolePermissions.Add(new RolePermission { TenantId = role.TenantId, RoleId = role.Id, PermissionKey = key });
            }
        }

        await db.SaveChangesAsync();
    }
}

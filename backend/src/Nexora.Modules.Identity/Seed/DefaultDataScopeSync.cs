using Nexora.Modules.Identity.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Nexora.Modules.Identity.Seed;

// Out of the box, no PermissionScope row means "All" (DataScopeService.ResolveAsync's default) —
// which meant every Manager could see every project in the company, not just the ones they
// manage or are staffed on. This seeds the sensible default (Mine) for the system Manager role's
// project.view the first time, additive/idempotent like RolePermissionSync: a role that already
// has ANY project.view scope configured (Mine, All, Department, or Specific — an Admin's own
// deliberate choice) is never touched. IsCustomized is unrelated to this — that flag only ever
// tracks RolePermissions edits (see RolePermissionSync), never PermissionScope.
public static class DefaultDataScopeSync
{
    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DbContext>();

        var managerRoles = (await db.Set<AppRole>().IgnoreQueryFilters().ToListAsync())
            .Where(r => r.Name == RoleTemplates.Manager && r.IsSystemRole)
            .ToList();

        var alreadyScopedRoleIds = (await db.Set<PermissionScope>().IgnoreQueryFilters()
            .Where(s => s.PermissionKey == Permission.Project.View)
            .Select(s => s.RoleId)
            .ToListAsync())
            .ToHashSet();

        foreach (var role in managerRoles)
        {
            if (alreadyScopedRoleIds.Contains(role.Id)) continue;
            db.Set<PermissionScope>().Add(new PermissionScope
            {
                TenantId = role.TenantId,
                RoleId = role.Id,
                PermissionKey = Permission.Project.View,
                ScopeType = DataScopeType.Mine,
            });
        }

        await db.SaveChangesAsync();
    }
}

using Nexora.Modules.Identity.Entities;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Identity.Services;

// Extends RoleTemplates.AssignableRolesByCreatorRole with a tenant's own custom roles.
// Only an Admin can hand out a custom role — HR's fixed [Employee, Manager] list never
// grows, since a custom role's permission set is opaque to RoleTemplates and could in
// principle carry Admin-level rights, exactly what HR is already barred from granting.
public static class AssignableRoleResolver
{
    public static async Task<string[]> ResolveAsync(DbContext db, Guid tenantId, string creatorRole)
    {
        if (!RoleTemplates.AssignableRolesByCreatorRole.TryGetValue(creatorRole, out var baseRoles)) return [];
        if (creatorRole != RoleTemplates.Admin) return baseRoles;

        var customRoleNames = await db.Set<AppRole>().IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && !r.IsSystemRole)
            .Select(r => r.Name!)
            .ToListAsync();

        return [.. baseRoles, .. customRoleNames];
    }

    // Which roles a Job Title may be *labeled* with — deliberately broader than ResolveAsync,
    // and deliberately NOT keyed by creatorRole. HR can create/rename a Job Title mapped to
    // any role Admin has defined (including a custom one) — that's just organizational
    // metadata, not a hiring action. The actual privilege boundary stays exactly where it
    // already was: UsersController.Create still calls ResolveAsync(db, tenantId, creatorRole)
    // to decide whether *this* caller may create a person holding that Job Title, so HR
    // creating a "Finance Director" title doesn't let HR hire into it — only an Admin can.
    // Excludes the Admin system role itself, same as Admin's own ResolveAsync result does —
    // nobody creates a Job Title for "Admin" outside tenant provisioning.
    public static async Task<string[]> AllTaggableRoleNamesAsync(DbContext db, Guid tenantId)
    {
        var baseRoles = RoleTemplates.AssignableRolesByCreatorRole[RoleTemplates.Admin];
        var customRoleNames = await db.Set<AppRole>().IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && !r.IsSystemRole)
            .Select(r => r.Name!)
            .ToListAsync();

        return [.. baseRoles, .. customRoleNames];
    }
}

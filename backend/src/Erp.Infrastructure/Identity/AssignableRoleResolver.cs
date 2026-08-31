using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Identity;

// Extends RoleTemplates.AssignableRolesByCreatorRole with a tenant's own custom roles.
// Only an Admin can hand out a custom role — HR's fixed [Employee, Manager] list never
// grows, since a custom role's permission set is opaque to RoleTemplates and could in
// principle carry Admin-level rights, exactly what HR is already barred from granting.
public static class AssignableRoleResolver
{
    public static async Task<string[]> ResolveAsync(ErpDbContext db, Guid tenantId, string creatorRole)
    {
        if (!RoleTemplates.AssignableRolesByCreatorRole.TryGetValue(creatorRole, out var baseRoles)) return [];
        if (creatorRole != RoleTemplates.Admin) return baseRoles;

        var customRoleNames = await db.Roles.IgnoreQueryFilters()
            .Where(r => r.TenantId == tenantId && !r.IsSystemRole)
            .Select(r => r.Name!)
            .ToListAsync();

        return [.. baseRoles, .. customRoleNames];
    }
}

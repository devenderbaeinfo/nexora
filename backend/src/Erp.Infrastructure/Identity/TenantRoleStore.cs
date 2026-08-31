using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Identity;

// ASP.NET Identity's RoleManager.CreateAsync and UserManager.AddToRoleAsync both validate/look
// up role names GLOBALLY (via the store's FindByNameAsync), with no idea our roles are scoped
// per tenant. Since every tenant legitimately has roles named "Admin", "HR", "Manager", etc.,
// that global check silently rejected every tenant's role creation after the first one ever
// created an "Admin" role anywhere — and AddToRoleAsync could then link a new tenant's user to
// a completely different tenant's role row. This bypasses Identity's role APIs entirely and
// works directly against our own (TenantId, NormalizedName) uniqueness instead.
public static class TenantRoleStore
{
    public static async Task<AppRole> EnsureRoleAsync(ErpDbContext db, Guid tenantId, string roleName)
    {
        var normalized = roleName.ToUpperInvariant();
        var existing = await db.Roles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.NormalizedName == normalized);
        if (existing is not null) return existing;

        var role = new AppRole { TenantId = tenantId, Name = roleName, NormalizedName = normalized, IsSystemRole = true };
        db.Roles.Add(role);
        await db.SaveChangesAsync();
        return role;
    }

    public static async Task AssignRoleAsync(ErpDbContext db, Guid tenantId, Guid userId, string roleName)
    {
        var role = await EnsureRoleAsync(db, tenantId, roleName);

        var alreadyAssigned = await db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == role.Id);
        if (alreadyAssigned) return;

        db.UserRoles.Add(new IdentityUserRole<Guid> { UserId = userId, RoleId = role.Id });
        await db.SaveChangesAsync();
    }
}

using System.Security.Claims;
using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Authorization;

public record ScopeDecision(DataScopeType Type, IReadOnlyList<Guid> SpecificIds)
{
    public static readonly ScopeDecision Unrestricted = new(DataScopeType.All, []);
}

// Centralized record/field authorization — the "Data Scope" and "Field Access" layers on
// top of the flat permission-claim check PermissionAuthorizationHandler already does. A
// permission claim answers "can this caller call this endpoint at all"; this answers
// "which specific records/fields within that response are they allowed to see."
// Never trust a client-supplied record id or role — every check here reads the caller's
// role(s) straight from the JWT's own "role_id" claims (set at login, can't be spoofed
// without the signing key) and resolves scope from the database.
public class DataScopeService
{
    private readonly ErpDbContext _db;
    public DataScopeService(ErpDbContext db) => _db = db;

    private static List<Guid> RoleIdsOf(ClaimsPrincipal user) =>
        user.Claims.Where(c => c.Type == "role_id")
            .Select(c => Guid.TryParse(c.Value, out var id) ? id : (Guid?)null)
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .ToList();

    // No PermissionScope row for this role+permission means "All" — the same unrestricted
    // behavior every role had before data scoping existed, so nothing changes for a tenant
    // that never configures this.
    public async Task<ScopeDecision> ResolveAsync(ClaimsPrincipal user, string permissionKey)
    {
        var roleIds = RoleIdsOf(user);
        if (roleIds.Count == 0) return ScopeDecision.Unrestricted;

        var scope = await _db.PermissionScopes
            .FirstOrDefaultAsync(s => roleIds.Contains(s.RoleId) && s.PermissionKey == permissionKey);
        if (scope is null) return ScopeDecision.Unrestricted;
        if (scope.ScopeType != DataScopeType.Specific) return new ScopeDecision(scope.ScopeType, []);

        var ids = await _db.PermissionScopeRecords
            .Where(r => r.PermissionScopeId == scope.Id)
            .Select(r => r.RecordId)
            .ToListAsync();
        return new ScopeDecision(DataScopeType.Specific, ids);
    }

    // No row means View — every field is visible by default, same as before field
    // permissions existed.
    public async Task<FieldAccessLevel> FieldAccessAsync(ClaimsPrincipal user, string resource, string fieldName)
    {
        var roleIds = RoleIdsOf(user);
        if (roleIds.Count == 0) return FieldAccessLevel.View;

        var perm = await _db.RoleFieldPermissions
            .FirstOrDefaultAsync(f => roleIds.Contains(f.RoleId) && f.Resource == resource && f.FieldName == fieldName);
        return perm?.Access ?? FieldAccessLevel.View;
    }
}

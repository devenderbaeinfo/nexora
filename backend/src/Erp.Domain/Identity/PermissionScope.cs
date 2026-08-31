using Erp.Domain.Common;

namespace Erp.Domain.Identity;

public enum DataScopeType { All, Mine, Department, Specific }

// Configured per (Role, PermissionKey). No row for a given role+permission means "All" —
// the same unrestricted behavior every role had before this existed, so a tenant that never
// touches this feature sees no change at all.
public class PermissionScope : TenantEntity
{
    public Guid RoleId { get; set; }
    public string PermissionKey { get; set; } = default!;
    public DataScopeType ScopeType { get; set; } = DataScopeType.All;
}

// Only populated when the owning PermissionScope.ScopeType == Specific — the explicit
// record allowlist ("only projects 101, 105, 109").
public class PermissionScopeRecord : TenantEntity
{
    public Guid PermissionScopeId { get; set; }
    public Guid RecordId { get; set; }
}

// Which permission keys can even be scoped this way — only ones that gate a list/record
// endpoint make sense here ("project.manage_budget" is an action, not something you'd view
// "My Department"'s worth of).
public static class DataScopeCatalog
{
    public static readonly string[] ScopablePermissions =
    [
        Permission.Project.View,
        Permission.People.View,
    ];

    // Which scope types are offered for a given permission — "Mine" only makes sense where
    // a record has a natural notion of "belongs to me" (a project you manage or are staffed
    // on); a plain employee directory has no such concept.
    public static DataScopeType[] AllowedScopeTypesFor(string permissionKey) => permissionKey switch
    {
        Permission.Project.View => [DataScopeType.All, DataScopeType.Mine, DataScopeType.Department, DataScopeType.Specific],
        Permission.People.View => [DataScopeType.All, DataScopeType.Department, DataScopeType.Specific],
        _ => [DataScopeType.All],
    };
}

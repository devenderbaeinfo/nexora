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
        // IAM-11: only ever narrows what a Payroll.Manage/Approve or Accounting.View holder
        // already sees broadly — a plain Employee's Payroll.View still means "my own payslips
        // only" regardless of any row here (enforced in PayrollController, not by this catalog's
        // "no row = All" default), so scoping this can't accidentally widen self-service access.
        Permission.Payroll.View,
        Permission.Accounting.View,
    ];

    // Which scope types are offered for a given permission — "Mine" only makes sense where
    // a record has a natural notion of "belongs to me" (a project you manage or are staffed
    // on); a plain employee directory has no such concept. Accounts have no employee/department
    // owner at all, so Accounting.View only ever offers All/Specific.
    public static DataScopeType[] AllowedScopeTypesFor(string permissionKey) => permissionKey switch
    {
        Permission.Project.View => [DataScopeType.All, DataScopeType.Mine, DataScopeType.Department, DataScopeType.Specific],
        Permission.People.View => [DataScopeType.All, DataScopeType.Department, DataScopeType.Specific],
        Permission.Payroll.View => [DataScopeType.All, DataScopeType.Department, DataScopeType.Specific],
        Permission.Accounting.View => [DataScopeType.All, DataScopeType.Specific],
        _ => [DataScopeType.All],
    };
}

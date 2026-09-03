using Erp.Domain.Common;

namespace Erp.Domain.Identity;

public enum FieldAccessLevel { Hidden, View, Edit }

// Per (Role, Resource, FieldName). No row means View — every field is visible by default,
// same as before this existed; a tenant opts a role into Hidden/Edit explicitly.
public class RoleFieldPermission : TenantEntity
{
    public Guid RoleId { get; set; }
    public string Resource { get; set; } = default!;
    public string FieldName { get; set; } = default!;
    public FieldAccessLevel Access { get; set; } = FieldAccessLevel.View;
}

// Which fields on which resources can be individually gated — kept to a short, deliberate
// list rather than reflecting over every entity property, since most fields on most
// entities have no reason to ever be hidden.
public static class FieldPermissionCatalog
{
    public static readonly Dictionary<string, string[]> FieldsByResource = new()
    {
        ["Project"] = ["BudgetAmount"],
        // IAM-11: lets a role that manages payroll structure (components, runs) be denied
        // visibility into actual compensation amounts — only ever applied to someone ELSE's
        // payslip; a viewer's own payslip always shows their own numbers regardless.
        ["Payslip"] = ["GrossEarnings", "NetPay"],
    };
}

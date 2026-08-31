using Erp.Domain.Common;

namespace Erp.Domain.Identity;

// Join row: which permission strings a given AppRole grants, within one tenant.
public class RolePermission : TenantEntity
{
    public Guid RoleId { get; set; }
    public string PermissionKey { get; set; } = default!;
}

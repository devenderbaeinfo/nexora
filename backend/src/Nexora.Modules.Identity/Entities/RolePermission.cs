using Nexora.Shared.Common;

namespace Nexora.Modules.Identity.Entities;

// Join row: which permission strings a given AppRole grants, within one tenant.
public class RolePermission : TenantEntity
{
    public Guid RoleId { get; set; }
    public string PermissionKey { get; set; } = default!;
}

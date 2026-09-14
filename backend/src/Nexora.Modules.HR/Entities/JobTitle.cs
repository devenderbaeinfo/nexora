using Nexora.Shared.Common;

namespace Nexora.Modules.HR.Entities;

// Replaces the old free-text Designation field: a small, tenant-managed list (Intern,
// Developer, Senior Developer, ...) so "who has what title" is queryable and consistent
// instead of every HR person typing their own spelling. HR can add new ones as the org grows;
// there's no delete here on purpose — retiring a title while employees still reference it
// would orphan their record, so it just accumulates like Department/LeaveType do.
public class JobTitle : TenantEntity
{
    public string Name { get; set; } = default!;

    // The access-control role (RoleTemplates.Admin/Hr/Manager/Finance/Employee) this title
    // grants — Job Title is now the single thing HR picks when adding someone; the system
    // role, and every permission that comes with it, follows automatically from this mapping
    // instead of being asked for separately.
    public string SystemRole { get; set; } = default!;
}

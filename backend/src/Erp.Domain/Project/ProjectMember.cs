using Erp.Domain.Common;

namespace Erp.Domain.Project;

// The project's own roster, separate from ProjectEntity.ProjectManagerId (which only ever
// names one person and drives expense-approval authorization). A member's RoleOnProject is
// free text — "Developer", "QA", "Design" — not tied to the org-wide Designation on Employee.
public class ProjectMember : TenantEntity
{
    public Guid ProjectId { get; set; }
    public Guid EmployeeId { get; set; }
    public string RoleOnProject { get; set; } = default!;
}

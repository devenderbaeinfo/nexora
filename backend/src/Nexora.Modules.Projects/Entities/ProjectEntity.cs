using Nexora.Shared.Common;

namespace Nexora.Modules.Projects.Entities;

public enum ProjectStatus { Active, OnHold, Completed, Cancelled }

// Named ProjectEntity (not Project) to avoid colliding with the Nexora.Modules.Projects.Entities namespace itself.
public class ProjectEntity : TenantEntity
{
    public string Name { get; set; } = default!;
    public Guid CustomerId { get; set; }

    // A single manager can own multiple projects at once — approving expenses on any of them
    // depends on this field, not on the org chart's reporting-manager relationship.
    public Guid ProjectManagerId { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public decimal BudgetAmount { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Active;
}

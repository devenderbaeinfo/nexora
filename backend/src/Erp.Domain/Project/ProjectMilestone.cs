using Erp.Domain.Common;

namespace Erp.Domain.Project;

public enum ProjectMilestoneStatus { Planned, InProgress, Completed, Delayed }

// A named checkpoint on a project's timeline, separate from ProjectTask (which tracks
// day-to-day work items). Milestones are what shows up on a client-facing schedule.
public class ProjectMilestone : TenantEntity
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = default!;
    public DateOnly? DueDate { get; set; }
    public ProjectMilestoneStatus Status { get; set; } = ProjectMilestoneStatus.Planned;
}

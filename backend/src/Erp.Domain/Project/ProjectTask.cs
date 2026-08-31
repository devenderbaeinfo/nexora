using Erp.Domain.Common;

namespace Erp.Domain.Project;

public enum ProjectTaskStatus { ToDo, InProgress, Done }

// A simple per-project task list — title, an optional assignee, a due date, and a
// three-state status. No subtasks, no board/swimlanes; just enough to track who's
// doing what on a project without building a whole PM tool.
public class ProjectTask : TenantEntity
{
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? AssignedToEmployeeId { get; set; }
    public ProjectTaskStatus Status { get; set; } = ProjectTaskStatus.ToDo;
    public DateOnly? DueDate { get; set; }
}

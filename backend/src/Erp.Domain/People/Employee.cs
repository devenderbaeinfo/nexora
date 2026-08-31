using Erp.Domain.Common;

namespace Erp.Domain.People;

public class Employee : TenantEntity
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string WorkEmail { get; set; } = default!;
    public string? PersonalPhone { get; set; }

    public Guid JobTitleId { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? LocationId { get; set; }

    // Current reporting manager, denormalized here for fast lookups; every change is
    // additionally recorded in EmployeeAssignmentHistory so past org charts stay accurate.
    public Guid? ReportingManagerId { get; set; }

    public EmploymentStatus Status { get; set; } = EmploymentStatus.Active;
    public DateOnly HireDate { get; set; }
    public DateOnly? TerminationDate { get; set; }
}

public enum EmploymentStatus
{
    Active,
    OnLeave,
    Terminated
}

// One row per change to department/manager/job title. Existing rows are never edited —
// a re-org appends a new row with EffectiveFrom, so a report run "as of last quarter" is still correct.
public class EmployeeAssignmentHistory : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid JobTitleId { get; set; }
    public Guid? ReportingManagerId { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public string? ChangeReason { get; set; }
}

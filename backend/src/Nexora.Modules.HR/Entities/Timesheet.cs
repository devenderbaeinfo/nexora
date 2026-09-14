using Nexora.Shared.Common;

namespace Nexora.Modules.HR.Entities;

public class AttendanceEntry : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public DateOnly WorkDate { get; set; }
    public DateTimeOffset ClockIn { get; set; }
    public DateTimeOffset? ClockOut { get; set; }
    public decimal? RegularHours { get; set; }
    public decimal? OvertimeHours { get; set; }
}

// Hours logged against a project/task — the bridge that feeds Project Expenses'
// "labour cost + expenses" budget view described in the SRS.
public class TimesheetEntry : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Guid ProjectId { get; set; }
    public DateOnly WorkDate { get; set; }
    public decimal Hours { get; set; }
    public bool IsBillable { get; set; }
    public string? Notes { get; set; }
    public TimesheetStatus Status { get; set; } = TimesheetStatus.Submitted;
}

public enum TimesheetStatus { Draft, Submitted, Approved, Rejected }

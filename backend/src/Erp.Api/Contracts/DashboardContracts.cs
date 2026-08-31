namespace Erp.Api.Contracts;

public record DashboardSummaryDto(
    int TeamSize,
    int PendingLeaveApprovals,
    int PendingExpenseApprovals,
    int PendingProjectExpenseApprovals,
    int ManagedProjectsCount,
    decimal ManagedProjectsBudgetTotal,
    decimal ManagedProjectsSpentTotal);

public record HeadcountPointDto(string Month, int Count);
public record AttendancePointDto(string Date, int Present, int ActiveEmployees);
public record HrTrendsDto(List<HeadcountPointDto> Headcount, List<AttendancePointDto> Attendance);

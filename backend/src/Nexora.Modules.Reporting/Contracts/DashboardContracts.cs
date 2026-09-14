namespace Nexora.Modules.Reporting.Contracts;

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

public record ExpenseCategoryDto(string Category, decimal Amount);
public record UpcomingLeaveDto(string EmployeeName, DateOnly StartDate, DateOnly EndDate, decimal Days);

// Every field is nullable and populated only if the caller holds the relevant permission —
// same progressive-disclosure principle as the rest of this controller, just per-field
// instead of per-endpoint, since one org-wide KPI row can mix People/Leave/Finance/Payroll
// visibility for a single caller (e.g. an HR admin without Accounting.View sees headcount
// and leave, not expenses or payroll cost).
public record DashboardKpisDto(
    int? TotalEmployees,
    double? TotalEmployeesDeltaPercent,
    int? OnLeaveToday,
    decimal? ExpensesMtd,
    double? ExpensesMtdDeltaPercent,
    List<ExpenseCategoryDto>? ExpenseByCategory,
    decimal? PayrollCostMtd,
    double? PayrollCostMtdDeltaPercent,
    List<UpcomingLeaveDto>? UpcomingLeaves,
    string? BaseCurrency);

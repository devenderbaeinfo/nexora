namespace Nexora.Modules.Reporting.Contracts;

public record TeamReportRowDto(
    Guid EmployeeId, string EmployeeName, string JobTitleName,
    int PendingLeaveRequests, decimal LeaveDaysUsedThisYear, int AttendanceDaysThisMonth);

public record ProjectReportRowDto(
    Guid ProjectId, string ProjectName, string Status,
    decimal BudgetAmount, decimal ApprovedSpend, decimal PendingSpend, decimal PercentSpent);

public record ExpenseReportRowDto(
    string Category, decimal ReimbursementTotal, decimal ProjectExpenseTotal, int Count);

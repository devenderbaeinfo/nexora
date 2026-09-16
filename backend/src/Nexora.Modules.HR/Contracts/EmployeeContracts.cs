namespace Nexora.Modules.HR.Contracts;

public record EmployeeListItem(
    Guid Id, string EmployeeCode, string FirstName, string LastName, string WorkEmail,
    string JobTitleName, string DepartmentName, string Status,
    Guid? ReportingManagerId = null, string? ReportingManagerName = null);

public record CreateEmployeeRequest(
    string FirstName, string LastName, string WorkEmail,
    Guid JobTitleId, Guid DepartmentId, Guid? LocationId,
    Guid? ReportingManagerId, DateOnly HireDate,
    // Must be explicitly true when ReportingManagerId is null — forces a deliberate choice
    // instead of a silently manager-less hire whose leave/timesheet/expense requests would
    // have nowhere to route.
    bool AcknowledgeNoManager = false);

public record SetReportingManagerRequest(Guid? ReportingManagerId);

public record EmployeeProfileDto(
    Guid Id, string EmployeeCode, string FirstName, string LastName, string WorkEmail, string? PersonalPhone,
    string JobTitleName, string DepartmentName, string? LocationName, string Status, DateOnly HireDate);

// HR/Admin's view of one specific employee's record — the profile page's Overview tab.
// Distinct from EmployeeProfileDto (that's always the caller's own record via /employees/me).
public record EmployeeDetailDto(
    Guid Id, string EmployeeCode, string FirstName, string LastName, string WorkEmail, string? PersonalPhone,
    string JobTitleName, string DepartmentName, string? LocationName,
    Guid? ReportingManagerId, string? ReportingManagerName, string Status, DateOnly HireDate);

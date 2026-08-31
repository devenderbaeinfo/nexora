namespace Erp.Api.Contracts;

public record EmployeeListItem(
    Guid Id, string FirstName, string LastName, string WorkEmail,
    string JobTitleName, string DepartmentName, string Status,
    Guid? ReportingManagerId = null, string? ReportingManagerName = null);

public record CreateEmployeeRequest(
    string FirstName, string LastName, string WorkEmail,
    Guid JobTitleId, Guid DepartmentId, Guid? LocationId,
    Guid? ReportingManagerId, DateOnly HireDate);

public record SetReportingManagerRequest(Guid? ReportingManagerId);

public record EmployeeProfileDto(
    Guid Id, string FirstName, string LastName, string WorkEmail, string? PersonalPhone,
    string JobTitleName, string DepartmentName, string? LocationName, string Status, DateOnly HireDate);

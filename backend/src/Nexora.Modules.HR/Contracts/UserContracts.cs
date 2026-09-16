namespace Nexora.Modules.HR.Contracts;

public record CreateUserRequest(
    string FirstName, string LastName, string WorkEmail,
    Guid JobTitleId, Guid DepartmentId, Guid? ReportingManagerId,
    DateOnly HireDate, string Password,
    // Which leave types this specific hire gets, and how many days of each — HR's per-person
    // call, not a blanket default. Null (not just empty) keeps the old "every type at its
    // configured default" behavior, so nothing already calling this endpoint breaks.
    List<LeaveAllotmentInput>? LeaveAllotments = null,
    // Must be explicitly true when ReportingManagerId is null — forces a deliberate choice
    // instead of a silently manager-less hire whose leave/timesheet/expense requests would
    // have nowhere to route.
    bool AcknowledgeNoManager = false);

public record UserSummaryDto(Guid UserId, Guid EmployeeId, string EmployeeCode, string DisplayName, string WorkEmail, string Role, bool CanDelete);
public record ResetPasswordRequest(string NewPassword);

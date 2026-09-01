using Erp.Domain.Timecard;

namespace Erp.Api.Contracts;

public record LeaveTypeDto(Guid Id, string Name, bool AllowsHalfDay, int SelfCertificationLimitDays, decimal AnnualAllowance, bool IsPaidLeave);

public record SubmitLeaveRequest(
    Guid LeaveTypeId, DateOnly StartDate, DateOnly EndDate,
    LeaveHalf Half, string? Reason, string? MedicalCertificateUrl);

public record LeaveRequestDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string LeaveTypeName,
    DateOnly StartDate, DateOnly EndDate, decimal DaysRequested,
    string Status, string? Reason,
    string ManagerApprovalStatus, string? ManagerActedByName, DateTimeOffset? ManagerActedAtUtc, string? ManagerComment,
    string HrApprovalStatus, string? HrActedByName, DateTimeOffset? HrActedAtUtc, string? HrComment,
    bool CanCancel);

public record DecideLeaveRequest(bool Approve, string? Note);

public record LeaveBalanceDto(string LeaveTypeName, decimal Allotted, decimal Used, decimal Remaining);

public record LeaveAllotmentInput(Guid LeaveTypeId, decimal Allotted);

public record EmployeeLeaveBalanceDto(Guid LeaveTypeId, string LeaveTypeName, decimal Allotted, decimal Used, decimal Remaining);

public record CreateLeaveTypeRequest(string Name, decimal AnnualAllowance, bool AllowsHalfDay, int SelfCertificationLimitDays, bool IsPaidLeave = true);
public record UpdateLeaveTypeRequest(string Name, decimal AnnualAllowance, bool AllowsHalfDay, int SelfCertificationLimitDays, bool IsPaidLeave = true);

public record LeaveHistoryItemDto(string LeaveTypeName, DateOnly StartDate, DateOnly EndDate, decimal DaysRequested, string Status);

public record LeaveReviewContextDto(
    string EmployeeName, string DepartmentName, string LeaveTypeName,
    decimal Allotted, decimal Used, decimal Remaining,
    List<LeaveHistoryItemDto> PreviousRequests);

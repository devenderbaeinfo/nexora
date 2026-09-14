namespace Nexora.Modules.Onboarding.Contracts;

public record FnfClearanceItemDto(
    Guid Id, Guid FnfCaseId, string Department, string Title, string Status,
    DateTimeOffset? ClearedAtUtc, string? Notes);

public record FnfCaseDto(
    Guid Id, Guid EmployeeId, string EmployeeName, string Status,
    decimal? FinalPayoutAmount, DateTimeOffset? ClosedAtUtc, List<FnfClearanceItemDto> Items);

public record StartFnfCaseRequest(Guid EmployeeId);

public record UpdateFnfItemRequest(bool Cleared, string? Notes);

public record CloseFnfCaseRequest(decimal FinalPayoutAmount);

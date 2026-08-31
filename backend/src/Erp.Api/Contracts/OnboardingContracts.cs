using Erp.Domain.Onboarding;

namespace Erp.Api.Contracts;

public record OnboardingTaskDto(
    Guid Id, Guid EmployeeId, string EmployeeName,
    string Title, string? Description, string Category, string Status,
    DateOnly? DueDate, DateTimeOffset? CompletedAtUtc, string? Notes);

public record StartOnboardingRequest(Guid EmployeeId);

public record AddOnboardingTaskRequest(
    Guid EmployeeId, string Title, string? Description,
    OnboardingTaskCategory Category, DateOnly? DueDate);

public record UpdateOnboardingTaskRequest(OnboardingTaskStatus Status, string? Notes);

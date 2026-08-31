namespace Erp.Api.Contracts;

public record CustomerDto(Guid Id, string Name, string? ContactEmail);
public record CreateCustomerRequest(string Name, string? ContactEmail, string? ContactPhone);

public record ProjectDto(Guid Id, string Name, string CustomerName, string ProjectManagerName, string Status, decimal BudgetAmount);
public record CreateProjectRequest(string Name, Guid CustomerId, Guid ProjectManagerId, DateOnly StartDate, DateOnly? EndDate, decimal BudgetAmount);

public record ProjectDetailDto(
    Guid Id, string Name, Guid CustomerId, string CustomerName, Guid ProjectManagerId, string ProjectManagerName,
    string Status, DateOnly StartDate, DateOnly? EndDate, decimal BudgetAmount);

public record UpdateProjectScheduleRequest(DateOnly StartDate, DateOnly? EndDate, Erp.Domain.Project.ProjectStatus Status);

public record ProjectMemberDto(Guid Id, Guid EmployeeId, string EmployeeName, string RoleOnProject);
public record AddProjectMemberRequest(Guid EmployeeId, string RoleOnProject);

public record MyProjectDto(Guid ProjectId, string Name, string CustomerName, string Status, string RoleOnProject);

public record ProjectBudgetDto(
    decimal BudgetAmount, decimal ApprovedSpend, decimal PendingSpend, decimal Remaining, decimal PercentSpent);

public record ProjectTaskDto(
    Guid Id, Guid ProjectId, string Title, string? Description,
    Guid? AssignedToEmployeeId, string? AssignedToName, string Status, DateOnly? DueDate,
    string? ProjectName = null);

public record CreateProjectTaskRequest(string Title, string? Description, Guid? AssignedToEmployeeId, DateOnly? DueDate);

public record UpdateProjectTaskRequest(Erp.Domain.Project.ProjectTaskStatus Status, Guid? AssignedToEmployeeId, DateOnly? DueDate);

public record UpdateTaskStatusRequest(Erp.Domain.Project.ProjectTaskStatus Status);

public record SubmitProjectExpenseRequest(Guid ProjectId, decimal Amount, string Category, string? Description, DateOnly IncurredOn, bool IsBillable);
public record ProjectExpenseDto(
    Guid Id, string ProjectName, string EmployeeName, decimal Amount, string Category,
    string? Description, DateOnly IncurredOn, bool IsBillable, string Status);
public record DecideProjectExpenseRequest(bool Approve, string? Note);

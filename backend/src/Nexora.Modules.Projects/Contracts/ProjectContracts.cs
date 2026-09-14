namespace Nexora.Modules.Projects.Contracts;

public record CustomerDto(Guid Id, string Name, string? ContactEmail);
public record CreateCustomerRequest(string Name, string? ContactEmail, string? ContactPhone);

// BudgetAmount is null when the caller's role has field-level access Hidden for
// Project.BudgetAmount (see RoleFieldPermission) — not the same thing as a project
// genuinely having no budget set.
public record ProjectDto(Guid Id, string Name, string CustomerName, string ProjectManagerName, string Status, decimal? BudgetAmount);
public record CreateProjectRequest(string Name, Guid CustomerId, Guid ProjectManagerId, DateOnly StartDate, DateOnly? EndDate, decimal BudgetAmount);

public record ProjectDetailDto(
    Guid Id, string Name, Guid CustomerId, string CustomerName, Guid ProjectManagerId, string ProjectManagerName,
    string Status, DateOnly StartDate, DateOnly? EndDate, decimal? BudgetAmount);

public record UpdateProjectScheduleRequest(DateOnly StartDate, DateOnly? EndDate, Nexora.Modules.Projects.Entities.ProjectStatus Status);

public record ProjectMemberDto(Guid Id, Guid EmployeeId, string EmployeeName, string RoleOnProject, decimal CostRate, decimal BillingRate);
public record AddProjectMemberRequest(Guid EmployeeId, string RoleOnProject, decimal CostRate = 0, decimal BillingRate = 0);
public record UpdateProjectMemberRatesRequest(decimal CostRate, decimal BillingRate);

public record MyProjectDto(Guid ProjectId, string Name, string CustomerName, string Status, string RoleOnProject);

public record ProjectBudgetDto(
    decimal BudgetAmount, decimal ApprovedSpend, decimal PendingSpend, decimal Remaining, decimal PercentSpent);

public record ProjectTaskDto(
    Guid Id, Guid ProjectId, string Title, string? Description,
    Guid? AssignedToEmployeeId, string? AssignedToName, string Status, DateOnly? DueDate,
    string? ProjectName = null);

public record CreateProjectTaskRequest(string Title, string? Description, Guid? AssignedToEmployeeId, DateOnly? DueDate);

public record UpdateProjectTaskRequest(Nexora.Modules.Projects.Entities.ProjectTaskStatus Status, Guid? AssignedToEmployeeId, DateOnly? DueDate);

public record UpdateTaskStatusRequest(Nexora.Modules.Projects.Entities.ProjectTaskStatus Status);

public record SubmitProjectExpenseRequest(Guid ProjectId, decimal Amount, string Category, string? Description, DateOnly IncurredOn, bool IsBillable);
public record ProjectExpenseDto(
    Guid Id, string ProjectName, string EmployeeName, decimal Amount, string Category,
    string? Description, DateOnly IncurredOn, bool IsBillable, string Status, Guid? JournalEntryId);
public record DecideProjectExpenseRequest(bool Approve, string? Note);

public record ProjectMilestoneDto(Guid Id, Guid ProjectId, string Name, DateOnly? DueDate, string Status);
public record CreateProjectMilestoneRequest(string Name, DateOnly? DueDate);
public record UpdateProjectMilestoneRequest(string Name, DateOnly? DueDate, Nexora.Modules.Projects.Entities.ProjectMilestoneStatus Status);

public record ProjectFinancialsMonthDto(string Label, decimal Revenue, decimal Cost);
public record ProjectFinancialsDto(
    decimal LaborCost, decimal LaborRevenue, decimal ExpenseCost, decimal ExpenseRevenue,
    decimal TotalCost, decimal TotalRevenue, decimal Profit, decimal MarginPercent,
    List<ProjectFinancialsMonthDto> Monthly);

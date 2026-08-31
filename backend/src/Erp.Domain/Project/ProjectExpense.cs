using Erp.Domain.Common;

namespace Erp.Domain.Project;

public enum ProjectExpenseStatus { Pending, ManagerApproved, Approved, Rejected }

// Distinct from Reimbursement: this is a cost tagged to a specific project, feeds project
// cost tracking, and — if billable — is meant to eventually become a customer invoice line.
// An employee's personal out-of-pocket claim with no project attached is Reimbursement instead.
public class ProjectExpense : TenantEntity
{
    public Guid ProjectId { get; set; }
    public Guid EmployeeId { get; set; }
    public decimal Amount { get; set; }
    public string Category { get; set; } = default!;
    public string? Description { get; set; }
    public DateOnly IncurredOn { get; set; }
    public bool IsBillable { get; set; }

    public ProjectExpenseStatus Status { get; set; } = ProjectExpenseStatus.Pending;
    public Guid WorkflowInstanceId { get; set; }
}

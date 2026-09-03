using Erp.Domain.Common;

namespace Erp.Domain.Reimbursement;

// The "employee expense" side of the SRS's expense split — a personal out-of-pocket cost with
// no project attached. A cost tagged to a specific project instead is Project Expense, a
// separate future module; the two are related but not the same business object.
public enum ReimbursementStatus { Pending, ManagerApproved, Approved, Rejected }

public class ReimbursementRequest : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public decimal Amount { get; set; }
    public string Category { get; set; } = default!; // Travel, Meals, Software, Other — free text for now
    public string? Description { get; set; }
    public string? ReceiptUrl { get; set; }
    public DateOnly IncurredOn { get; set; }

    public ReimbursementStatus Status { get; set; } = ReimbursementStatus.Pending;
    public Guid WorkflowInstanceId { get; set; }

    // Set once Finance's final approval posts the real accounting entry (see
    // IAccountingPostingService) — "money is owed and cleared to pay."
    public bool PostedForPayment { get; set; }
    public Guid? JournalEntryId { get; set; }
}

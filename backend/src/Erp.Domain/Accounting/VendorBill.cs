using Erp.Domain.Common;

namespace Erp.Domain.Accounting;

public enum VendorBillStatus { Pending, Approved, Rejected, Paid }

// FIN-10: a single-amount-per-category bill, same shape as ProjectExpense/ReimbursementRequest
// elsewhere in this codebase rather than a multi-line invoice — consistent with the existing
// "minimal core" scope, not a full AP line-item ledger.
// Lifecycle: Pending (submitted) -> Approved (posts Debit "{Category} Expense" / Credit
// "Accounts Payable") -> Paid (posts Debit "Accounts Payable" / Credit Cash), or -> Rejected.
public class VendorBill : TenantEntity
{
    public Guid VendorId { get; set; }
    public string BillNumber { get; set; } = default!;
    public DateOnly BillDate { get; set; }
    public DateOnly DueDate { get; set; }
    public string Category { get; set; } = default!;
    public decimal Amount { get; set; }
    public VendorBillStatus Status { get; set; } = VendorBillStatus.Pending;

    public Guid SubmittedByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }
    public Guid? JournalEntryId { get; set; }
    public string? RejectionReason { get; set; }

    public DateTimeOffset? PaidAtUtc { get; set; }
    public Guid? PaymentJournalEntryId { get; set; }
}

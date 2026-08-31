using System.ComponentModel.DataAnnotations.Schema;
using Erp.Domain.Common;

namespace Erp.Domain.Timecard;

public enum LeaveHalf { None, First, Second }

// Strict two-level approval: Manager approval is always an intermediate stage, never a final
// one — a request only ever reaches Approved via PendingHrApproval. Numeric values are pinned
// explicitly because they're already persisted under the old names: Pending=0/ManagerApproved=1
// are a rename, not new states, and Rejected=3 is repurposed as RejectedByManager since every
// row rejected before HR-side rejection existed was a manager rejection. RejectedByHr=5 and
// Draft=6 are new.
public enum LeaveRequestStatus
{
    PendingManagerApproval = 0,
    PendingHrApproval = 1,
    Approved = 2,
    RejectedByManager = 3,
    Cancelled = 4,
    RejectedByHr = 5,
    Draft = 6,
}

// Per-stage state, tracked independently of the overall Status so the UI can show "Approved by
// Manager — Pending HR" rather than inferring it from one enum value. HR's stage stays
// NotRequired until the manager actually approves — "HR can't act on a request the manager
// hasn't approved" reduces to exactly this field never reaching Pending otherwise.
public enum ApprovalStageStatus { NotRequired, Pending, Approved, Rejected }

public class LeaveRequest : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Guid LeaveTypeId { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveHalf Half { get; set; } = LeaveHalf.None;

    // Computed at submission time from StartDate/EndDate/Half — a half-day request
    // debits exactly 0.5, never a full day, and can't be combined with a multi-day range.
    public decimal DaysRequested { get; set; }

    public string? Reason { get; set; }
    public string? MedicalCertificateUrl { get; set; }

    // Mirrors the linked WorkflowInstance's state for cheap reads (list views, filters)
    // without a join — the WorkflowInstance + WorkflowDecision rows remain the source of truth.
    public LeaveRequestStatus Status { get; set; } = LeaveRequestStatus.PendingManagerApproval;
    public Guid WorkflowInstanceId { get; set; }

    // The balance is only ever debited once the workflow reaches Approved (HR's sign-off) — never before.
    public bool BalanceDebited { get; set; }

    public ApprovalStageStatus ManagerApprovalStatus { get; set; } = ApprovalStageStatus.Pending;
    public Guid? ManagerActedByUserId { get; set; }
    public DateTimeOffset? ManagerActedAtUtc { get; set; }
    public string? ManagerComment { get; set; }

    // Starts NotRequired, not Pending — it only ever becomes Pending once the manager
    // actually approves (see DecideAsManager), matching the strict two-level rule that HR
    // has nothing to act on until that happens.
    public ApprovalStageStatus HrApprovalStatus { get; set; } = ApprovalStageStatus.NotRequired;
    public Guid? HrActedByUserId { get; set; }
    public DateTimeOffset? HrActedAtUtc { get; set; }
    public string? HrComment { get; set; }
}

// One row per employee per leave type per year, updated only through approval/cancellation —
// never edited directly, so the running balance always matches the approval trail.
public class LeaveBalance : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public Guid LeaveTypeId { get; set; }
    public int Year { get; set; }
    public decimal Allotted { get; set; }
    public decimal Used { get; set; }

    [NotMapped]
    public decimal Remaining => Allotted - Used;
}

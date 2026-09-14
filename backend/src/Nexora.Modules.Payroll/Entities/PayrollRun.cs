using Nexora.Shared.Common;

namespace Nexora.Modules.Payroll.Entities;

// Calculation -> Approval -> Disbursement, matching the same "prepared by one role,
// authorized to move money by another" shape as Reimbursement/ProjectExpense: HR
// prepares (Draft), Finance signs off (Approved) and releases funds (Disbursed).
public enum PayrollRunStatus { Draft, Approved, Disbursed }

// One per tenant per calendar month. PeriodMonth/PeriodYear (not a DateOnly) because a
// payroll period IS a whole month, never a range within one.
public class PayrollRun : TenantEntity
{
    public int PeriodMonth { get; set; }
    public int PeriodYear { get; set; }
    public PayrollRunStatus Status { get; set; } = PayrollRunStatus.Draft;

    public Guid? ApprovedByUserId { get; set; }
    public DateTimeOffset? ApprovedAtUtc { get; set; }

    public Guid? DisbursedByUserId { get; set; }
    public DateTimeOffset? DisbursedAtUtc { get; set; }

    // Set once disbursement posts the summary entry to the accounting core (Part 8 Flow 6:
    // Payroll -> Accounting) — lets the UI link straight to the journal entry it produced.
    public Guid? JournalEntryId { get; set; }

    // Snapshotted at processing time, comma-separated — an employee who lacked a salary
    // structure back then and has one now shouldn't retroactively disappear from this
    // historical run's skipped list.
    public string? SkippedEmployeeNames { get; set; }
}

// One per employee per run — a snapshot, not a live view. Recalculating never touches an
// already-generated payslip; each PayrollRun is calculated once at creation time.
public class Payslip : TenantEntity
{
    public Guid PayrollRunId { get; set; }
    public Guid EmployeeId { get; set; }

    public int DaysInMonth { get; set; }
    public decimal LopDays { get; set; }

    public decimal GrossEarnings { get; set; }
    public decimal LopDeduction { get; set; }
    public decimal OtherDeductions { get; set; }
    public decimal NetPay { get; set; }
}

// Snapshot of each salary component's computed amount at calculation time — so a later
// raise or structure change never retroactively rewrites a historical payslip's breakdown.
public class PayslipLine : TenantEntity
{
    public Guid PayslipId { get; set; }
    public string ComponentName { get; set; } = default!;
    public SalaryComponentType Type { get; set; }
    public decimal Amount { get; set; }
    public int SortOrder { get; set; }
}

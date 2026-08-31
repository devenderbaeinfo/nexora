using Erp.Domain.Common;

namespace Erp.Domain.Offboarding;

public enum FnfCaseStatus
{
    InProgress,
    Completed
}

public enum FnfClearanceDepartment
{
    Manager,
    Finance,
    It,
    Hr
}

public enum FnfClearanceStatus
{
    Pending,
    Cleared
}

// One case per exiting employee — the header that carries the final payout number and
// overall close date. Nothing here is settled until every FnfClearanceItem underneath
// it is Cleared; Close() is the only place FinalPayoutAmount ever gets written.
public class FnfCase : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public FnfCaseStatus Status { get; set; } = FnfCaseStatus.InProgress;
    public decimal? FinalPayoutAmount { get; set; }
    public DateTimeOffset? ClosedAtUtc { get; set; }
}

public class FnfClearanceItem : TenantEntity
{
    public Guid FnfCaseId { get; set; }
    public Guid EmployeeId { get; set; }
    public FnfClearanceDepartment Department { get; set; }
    public string Title { get; set; } = default!;
    public FnfClearanceStatus Status { get; set; } = FnfClearanceStatus.Pending;
    public DateTimeOffset? ClearedAtUtc { get; set; }
    public string? Notes { get; set; }
}

// Starter clearance checklist seeded when HR initiates a case — same "starting point, not
// a rulebook" idea as OnboardingDefaultTemplate: HR can add more items on top of this.
public static class FnfDefaultTemplate
{
    public static readonly (string Title, FnfClearanceDepartment Department)[] Items =
    [
        ("Confirm resignation/exit acceptance & last working day", FnfClearanceDepartment.Hr),
        ("Reporting manager sign-off on handover", FnfClearanceDepartment.Manager),
        ("Return assigned assets (laptop, badge, etc.)", FnfClearanceDepartment.It),
        ("Revoke system & email access", FnfClearanceDepartment.It),
        ("Clear pending expense claims & advances", FnfClearanceDepartment.Finance),
        ("Compute final payout (salary, leave encashment, deductions)", FnfClearanceDepartment.Finance),
    ];
}

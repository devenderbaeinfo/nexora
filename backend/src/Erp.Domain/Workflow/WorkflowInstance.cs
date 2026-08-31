using Erp.Domain.Common;

namespace Erp.Domain.Workflow;

public enum WorkflowStatus { InProgress, Approved, Rejected, Cancelled }

// One row per approvable thing (a LeaveRequest, a Reimbursement, later a ProjectExpense).
// The engine owns the state machine — whose turn it is, and whether it's finished — while
// each module's own controller still owns the domain-specific question of who is allowed
// to act at a given stage (a request's own manager vs. anyone holding a Finance/HR permission).
public class WorkflowInstance : TenantEntity
{
    public string EntityType { get; set; } = default!;   // "LeaveRequest", "Reimbursement", ...
    public Guid EntityId { get; set; }

    // Ordered stage names for this instance, fixed at start from WorkflowDefinitions —
    // stored on the instance (not just looked up live) so a later change to the definition
    // never rewrites the rules under an approval that's already partway through.
    public string StagesCsv { get; set; } = default!;
    public int CurrentStageIndex { get; set; }
    public WorkflowStatus Status { get; set; } = WorkflowStatus.InProgress;

    public string[] Stages => StagesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries);
    public string? CurrentStage => Status == WorkflowStatus.InProgress && CurrentStageIndex < Stages.Length
        ? Stages[CurrentStageIndex]
        : null;
}

// Append-only decision log — one row per stage decision, never edited.
public class WorkflowDecision : TenantEntity
{
    public Guid WorkflowInstanceId { get; set; }
    public string StageName { get; set; } = default!;
    public Guid DecidedByUserId { get; set; }
    public bool Approved { get; set; }
    public string? Note { get; set; }
}

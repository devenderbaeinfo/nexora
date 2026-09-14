using Nexora.Shared.Common;

namespace Nexora.Modules.Workflow.Entities;

// Raised once, when a WorkflowInstance reaches its final stage — the one fact that today
// only exists implicitly (as "CurrentStageIndex >= Stages.Length"), never recorded anywhere
// as its own event. Per-stage decisions (e.g. "leave.approve_as_manager") are still logged
// by each controller directly; this is the cross-cutting "the whole chain is done" signal,
// shared by Leave/Reimbursement/ProjectExpense/whatever uses this engine next.
public sealed record WorkflowApprovalCompletedEvent(string EntityType, Guid EntityId, Guid WorkflowInstanceId) : DomainEvent;

using Nexora.Modules.Workflow.Entities;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Workflow.Services;

public record WorkflowDecisionOutcome(bool Applied, bool IsFullyApproved, bool IsRejected, string? Reason);

public interface IApprovalWorkflowService
{
    Task<WorkflowInstance> StartAsync(string entityType, Guid entityId);

    // Same as StartAsync, but with an explicit stage list instead of looking one up from the
    // static WorkflowDefinitions dictionary — used by LeaveRequest once a tenant has configured
    // a custom ApprovalChainDefinition (see IApprovalChainResolver). Stored on the instance the
    // same way either way, so DecideAsync/CurrentStage work identically regardless of source.
    Task<WorkflowInstance> StartWithStagesAsync(string entityType, Guid entityId, IReadOnlyList<string> stageNames);

    // expectedStage guards against a stale client call acting on a stage the instance has
    // already moved past — the instance's own CurrentStage is the source of truth, this is
    // just belt-and-braces so a race doesn't silently apply a decision to the wrong stage.
    Task<WorkflowDecisionOutcome> DecideAsync(Guid workflowInstanceId, string expectedStage, Guid actorUserId, bool approve, string? note);

    Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId);
}

public class ApprovalWorkflowService : IApprovalWorkflowService
{
    private readonly DbContext _db;
    public ApprovalWorkflowService(DbContext db) => _db = db;

    public Task<WorkflowInstance> StartAsync(string entityType, Guid entityId) =>
        StartWithStagesAsync(entityType, entityId, WorkflowDefinitions.StagesFor(entityType));

    public async Task<WorkflowInstance> StartWithStagesAsync(string entityType, Guid entityId, IReadOnlyList<string> stageNames)
    {
        var instance = new WorkflowInstance
        {
            EntityType = entityType,
            EntityId = entityId,
            StagesCsv = string.Join(',', stageNames),
            CurrentStageIndex = 0,
            Status = WorkflowStatus.InProgress,
        };
        _db.Set<WorkflowInstance>().Add(instance);
        await _db.SaveChangesAsync();
        return instance;
    }

    public Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId) =>
        _db.Set<WorkflowInstance>().FirstOrDefaultAsync(w => w.Id == workflowInstanceId);

    public async Task<WorkflowDecisionOutcome> DecideAsync(
        Guid workflowInstanceId, string expectedStage, Guid actorUserId, bool approve, string? note)
    {
        var instance = await _db.Set<WorkflowInstance>().FirstOrDefaultAsync(w => w.Id == workflowInstanceId);
        if (instance is null) return new WorkflowDecisionOutcome(false, false, false, "Workflow not found.");
        if (instance.Status != WorkflowStatus.InProgress) return new WorkflowDecisionOutcome(false, false, false, "Already decided.");
        if (instance.CurrentStage != expectedStage) return new WorkflowDecisionOutcome(false, false, false, "Not at this stage.");

        _db.Set<WorkflowDecision>().Add(new WorkflowDecision
        {
            WorkflowInstanceId = instance.Id,
            StageName = expectedStage,
            DecidedByUserId = actorUserId,
            Approved = approve,
            Note = note,
        });

        if (!approve)
        {
            instance.Status = WorkflowStatus.Rejected;
            await _db.SaveChangesAsync();
            return new WorkflowDecisionOutcome(true, false, true, null);
        }

        instance.CurrentStageIndex++;
        var isLastStage = instance.CurrentStageIndex >= instance.Stages.Length;
        if (isLastStage)
        {
            instance.Status = WorkflowStatus.Approved;
            instance.AddDomainEvent(new WorkflowApprovalCompletedEvent(instance.EntityType, instance.EntityId, instance.Id));
        }
        await _db.SaveChangesAsync();

        return new WorkflowDecisionOutcome(true, isLastStage, false, null);
    }
}

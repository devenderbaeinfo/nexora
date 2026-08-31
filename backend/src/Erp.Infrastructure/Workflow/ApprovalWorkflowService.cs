using Erp.Domain.Workflow;
using Erp.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.Infrastructure.Workflow;

public record WorkflowDecisionOutcome(bool Applied, bool IsFullyApproved, bool IsRejected, string? Reason);

public interface IApprovalWorkflowService
{
    Task<WorkflowInstance> StartAsync(string entityType, Guid entityId);

    // expectedStage guards against a stale client call acting on a stage the instance has
    // already moved past — the instance's own CurrentStage is the source of truth, this is
    // just belt-and-braces so a race doesn't silently apply a decision to the wrong stage.
    Task<WorkflowDecisionOutcome> DecideAsync(Guid workflowInstanceId, string expectedStage, Guid actorUserId, bool approve, string? note);

    Task<WorkflowInstance?> GetAsync(Guid workflowInstanceId);
}

public class ApprovalWorkflowService : IApprovalWorkflowService
{
    private readonly ErpDbContext _db;
    public ApprovalWorkflowService(ErpDbContext db) => _db = db;

    public async Task<WorkflowInstance> StartAsync(string entityType, Guid entityId)
    {
        var stages = WorkflowDefinitions.StagesFor(entityType);
        var instance = new WorkflowInstance
        {
            EntityType = entityType,
            EntityId = entityId,
            StagesCsv = string.Join(',', stages),
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
        }
        await _db.SaveChangesAsync();

        return new WorkflowDecisionOutcome(true, isLastStage, false, null);
    }
}

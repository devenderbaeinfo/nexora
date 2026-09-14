using Nexora.Shared.Common;
using Nexora.Shared.Common;
using Nexora.Modules.Workflow.Entities;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Workflow.Services;

// First real consumer of the event pipeline: records "this whole approval chain finished",
// a fact that today has no dedicated log line (only individual stage decisions are logged,
// e.g. "leave.approve_as_hr" — nothing marks the chain itself as complete).
public class WorkflowApprovalAuditHandler(DbContext db) : IDomainEventHandler<WorkflowApprovalCompletedEvent>
{
    public async Task HandleAsync(WorkflowApprovalCompletedEvent domainEvent, Guid tenantId, CancellationToken ct)
    {
        // Idempotent by construction rather than via a dedicated dedupe table: the outbox
        // guarantees at-least-once delivery, so a redelivered event must not double-write.
        // IgnoreQueryFilters + explicit tenantId is required here too — there's no ambient
        // tenant in this background context for the normal query filter to key off of.
        var alreadyRecorded = await db.Set<AuditLog>().IgnoreQueryFilters().AnyAsync(a =>
            a.TenantId == tenantId &&
            a.EntityId == domainEvent.EntityId &&
            a.Action == "workflow.fully_approved", ct);
        if (alreadyRecorded) return;

        db.Set<AuditLog>().Add(new AuditLog
        {
            TenantId = tenantId,
            Action = "workflow.fully_approved",
            EntityType = domainEvent.EntityType,
            EntityId = domainEvent.EntityId,
            Metadata = $"{{\"workflowInstanceId\":\"{domainEvent.WorkflowInstanceId}\"}}",
        });
        await db.SaveChangesAsync(ct);
    }
}

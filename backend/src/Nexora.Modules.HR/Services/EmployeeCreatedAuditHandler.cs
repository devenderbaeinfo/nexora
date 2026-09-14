using Nexora.Shared.Common;
using Nexora.Shared.Common;
using Nexora.Modules.HR.Entities;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Services;

// A second, deliberately separate consumer in a different module (People, not Workflow) —
// proves the same generic dispatcher/outbox handles more than one event type without any
// event-specific code in the pipeline itself. Kept intentionally small (an audit row, not a
// fabricated notification/reporting side effect) — this is a proof of the mechanism, not a
// stand-in for building the Notifications module the vision describes as separate work.
public class EmployeeCreatedAuditHandler(DbContext db) : IDomainEventHandler<EmployeeCreatedEvent>
{
    public async Task HandleAsync(EmployeeCreatedEvent domainEvent, Guid tenantId, CancellationToken ct)
    {
        var alreadyRecorded = await db.Set<AuditLog>().IgnoreQueryFilters().AnyAsync(a =>
            a.TenantId == tenantId &&
            a.EntityId == domainEvent.EmployeeId &&
            a.Action == "people.employee_created_event", ct);
        if (alreadyRecorded) return;

        db.Set<AuditLog>().Add(new AuditLog
        {
            TenantId = tenantId,
            Action = "people.employee_created_event",
            EntityType = "Employee",
            EntityId = domainEvent.EmployeeId,
            Metadata = $"{{\"fullName\":{System.Text.Json.JsonSerializer.Serialize(domainEvent.FullName)}}}",
        });
        await db.SaveChangesAsync(ct);
    }
}

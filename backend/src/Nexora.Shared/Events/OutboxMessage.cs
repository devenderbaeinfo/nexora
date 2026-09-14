using Nexora.Shared.Common;

namespace Nexora.Shared.Events;

// The Outbox row itself: written in the same SaveChanges/transaction as whatever business
// data raised the event (see DbContext.EnqueueOutboxMessages), so "the business operation
// succeeded but the event was lost" can't happen — either both commit or neither does.
// OutboxDispatcherService is the only thing that ever reads/updates these.
public class OutboxMessage : TenantEntity
{
    // The entity that raised the event — TenantId/AggregateId both come from that entity at
    // enqueue time, not from the event payload itself (see IDomainEvent's doc comment).
    public Guid AggregateId { get; set; }

    // AssemblyQualifiedName of the concrete event record — stable within one deployed build
    // of this monolith, which is all a same-process dispatcher needs. Would need a proper
    // type registry/versioning scheme if this process ever stopped being the only reader.
    public string EventType { get; set; } = default!;
    public string PayloadJson { get; set; } = default!;

    public Guid? CorrelationId { get; set; }
    public Guid? CausationId { get; set; }
    public int Version { get; set; } = 1;

    public DateTimeOffset OccurredAtUtc { get; set; } = DateTimeOffset.UtcNow;

    // Null = still pending. Set once OutboxDispatcherService has run every registered handler
    // for this event without one of them throwing.
    public DateTimeOffset? ProcessedAtUtc { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}

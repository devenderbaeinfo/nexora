namespace Nexora.Shared.Common;

// A business fact that already happened, raised by the aggregate that owns it. Deliberately
// thin — TenantId/AggregateId/CorrelationId live on the Outbox envelope (Erp.Infrastructure),
// not duplicated into every event payload, since the entity that raises the event already
// carries its own Id/TenantId and NexoraDbContext.SaveChanges reads them from there.
public interface IDomainEvent
{
    Guid EventId { get; }
    DateTimeOffset OccurredAtUtc { get; }
}

public abstract record DomainEvent : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTimeOffset OccurredAtUtc { get; } = DateTimeOffset.UtcNow;
}

// Implemented in Erp.Infrastructure (handlers need NexoraDbContext). tenantId is passed
// explicitly rather than read from ambient context, because handlers run from a background
// dispatcher with no HTTP request/JWT to resolve a tenant from — see OutboxDispatcherService.
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, Guid tenantId, CancellationToken ct);
}

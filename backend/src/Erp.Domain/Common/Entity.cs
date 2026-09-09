namespace Erp.Domain.Common;

// Every tenant-owned row carries TenantId so a single leaked/forgotten WHERE clause
// can never leak another company's data — enforced again at the query-filter level.
public abstract class TenantEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    // Soft delete only: financial and audit-adjacent rows must never physically disappear.
    public bool IsDeleted { get; set; }

    // Not persisted (see ErpDbContext.OnModelCreating, which .Ignore()s this for every
    // TenantEntity subtype) — a transient in-memory queue an aggregate fills via
    // AddDomainEvent while its properties are being changed. ErpDbContext.SaveChanges reads
    // it off every tracked entity and turns it into an Outbox row in the same transaction as
    // the business data, then clears it — see Erp.Infrastructure.Events.OutboxMessage.
    private readonly List<IDomainEvent> _domainEvents = [];
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents;
    public void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
    public void ClearDomainEvents() => _domainEvents.Clear();
}

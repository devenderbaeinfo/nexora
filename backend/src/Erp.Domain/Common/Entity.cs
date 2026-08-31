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
}

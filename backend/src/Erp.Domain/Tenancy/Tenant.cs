namespace Erp.Domain.Tenancy;

// A customer company. Not a TenantEntity itself — this is the root everything else hangs off.
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = default!;

    // Used as a login-time hint and in subdomains later (e.g. acme.erp.app) — must stay unique and stable.
    public string Slug { get; set; } = default!;

    public TenantStatus Status { get; set; } = TenantStatus.Active;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public enum TenantStatus
{
    Active,
    Suspended,
    Trial
}

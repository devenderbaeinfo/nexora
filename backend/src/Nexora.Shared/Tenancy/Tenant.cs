namespace Nexora.Shared.Tenancy;

// A customer company. Not a TenantEntity itself — this is the root everything else hangs off.
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = default!;

    // Used as a login-time hint and in subdomains later (e.g. acme.erp.app) — must stay unique and stable.
    public string Slug { get; set; } = default!;

    public TenantStatus Status { get; set; } = TenantStatus.Active;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    // Null means "Custom" — modules are configured directly on this tenant (see TenantModule)
    // rather than inherited from a named Plan's PlanModule set.
    public Guid? PlanId { get; set; }

    // ISO 4217 code (e.g. "INR", "USD") — the currency every consolidated report (Trial
    // Balance, P&L, Balance Sheet, Cash Flow) is expressed in. An individual Account can be
    // denominated in a different currency (see Account.Currency); every JournalLine on it
    // carries the exchange rate back to this at posting time.
    public string BaseCurrencyCode { get; set; } = "INR";
}

public enum TenantStatus
{
    Active,
    Suspended,
    Trial
}

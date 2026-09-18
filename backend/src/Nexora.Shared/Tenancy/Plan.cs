namespace Nexora.Shared.Tenancy;

// A subscription tier a SuperAdmin can assign to a Tenant at creation or later. Not a
// TenantEntity — this is platform-catalogue data shared across every tenant, managed only
// by SuperAdmins, the same way Tenant itself isn't tenant-scoped data.
public class Plan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = default!;

    // Null when IsCustomPricing is true (e.g. "Enterprise" shows "Custom Pricing" instead of an amount).
    public decimal? MonthlyPrice { get; set; }
    public bool IsCustomPricing { get; set; }

    // Null = unlimited.
    public int? MaxUsers { get; set; }

    public PlanStatus Status { get; set; } = PlanStatus.Active;
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public bool IsDeleted { get; set; }
}

public enum PlanStatus
{
    Active,
    Deprecated
}

// One row per module a Plan includes. ModuleKey is validated against ModuleCatalog at the
// API boundary, not via a DB FK — the catalogue is a compile-time list, not a table.
public class PlanModule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PlanId { get; set; }
    public string ModuleKey { get; set; } = default!;
}

// The effective, resolved set of modules a Tenant is entitled to right now — always populated
// (whether the tenant is on a named Plan or "Custom"), so every runtime check is a single flat
// lookup here rather than a join through Plan. Recomputed in full by
// ITenantModuleProvisioningService whenever a tenant is created or its plan/modules change.
public class TenantModule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string ModuleKey { get; set; } = default!;
}

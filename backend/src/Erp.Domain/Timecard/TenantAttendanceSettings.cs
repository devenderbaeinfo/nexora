using Erp.Domain.Common;

namespace Erp.Domain.Timecard;

// One row per tenant. No row means the default (8h) applies — a tenant that never touches
// this sees the exact same behavior as before this setting existed. Standard workday length
// is a real company policy (7/7.5/8/9h are all common), not a technical constant, so it has
// no business being a compile-time value shared by every tenant.
public class TenantAttendanceSettings : TenantEntity
{
    public decimal StandardWorkDayHours { get; set; } = 8m;
}

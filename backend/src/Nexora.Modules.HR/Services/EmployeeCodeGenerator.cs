using Microsoft.EntityFrameworkCore;
using Nexora.Modules.HR.Entities;
using Nexora.Shared.Tenancy;

namespace Nexora.Modules.HR.Services;

// Sequential per tenant, prefixed with the tenant's slug (e.g. "ACME-0001") — assigned once
// at creation and never reused, since Employee rows are deactivated, not deleted.
public static class EmployeeCodeGenerator
{
    public static async Task<string> NextAsync(DbContext db, Guid tenantId)
    {
        var tenant = await db.Set<Tenant>().IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId);
        var count = await db.Set<Employee>().CountAsync();
        return $"{tenant.Slug.ToUpperInvariant()}-{count + 1:D4}";
    }
}

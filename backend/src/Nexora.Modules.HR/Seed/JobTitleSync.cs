using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Seed;

// Every tenant gets this starter set of job titles if it doesn't have them yet — additive,
// same shape as RolePermissionSync, so a tenant created before this list existed still ends
// up with a usable set instead of an empty dropdown the first time HR tries to add someone.
// All default to the Employee system role; HR can add its own titles mapped to Manager/etc.
public static class JobTitleSync
{
    private static readonly string[] DefaultTitles = ["Intern", "Developer", "Senior Developer"];

    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NexoraDbContext>();

        var tenantIds = await db.Tenants.IgnoreQueryFilters().Select(t => t.Id).ToListAsync();
        // Case-insensitive to match the (TenantId, Name) unique index's default SQL Server
        // collation — a HashSet with the default ordinal comparer would treat "Intern" and
        // "intern" as different, seed a duplicate insert, and blow up the unique constraint.
        var existingByTenant = (await db.JobTitles.IgnoreQueryFilters().ToListAsync())
            .GroupBy(j => j.TenantId)
            .ToDictionary(g => g.Key, g => g.Select(j => j.Name).ToHashSet(StringComparer.OrdinalIgnoreCase));

        foreach (var tenantId in tenantIds)
        {
            var existing = existingByTenant.GetValueOrDefault(tenantId, []);
            foreach (var title in DefaultTitles)
            {
                if (existing.Contains(title)) continue;
                db.JobTitles.Add(new JobTitle { TenantId = tenantId, Name = title, SystemRole = RoleTemplates.Employee });
            }
        }

        await db.SaveChangesAsync();
    }
}

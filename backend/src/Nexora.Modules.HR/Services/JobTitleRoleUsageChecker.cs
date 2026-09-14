using Nexora.Modules.HR.Entities;
using Nexora.Modules.Identity.Services;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Services;

public class JobTitleRoleUsageChecker(DbContext db) : IRoleUsageChecker
{
    public Task<Dictionary<string, int>> CountByRoleNameAsync() =>
        db.Set<JobTitle>()
            .GroupBy(j => j.SystemRole)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Role, x => x.Count);

    public Task<bool> IsRoleInUseAsync(string roleName) =>
        db.Set<JobTitle>().AnyAsync(j => j.SystemRole == roleName);
}

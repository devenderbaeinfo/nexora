using Nexora.Modules.Projects.Entities;
using Nexora.Shared.Authorization;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Projects.Services;

public class ProjectDirectory(DbContext db) : IProjectDirectory
{
    public Task<bool> ExistsAsync(Guid projectId) =>
        db.Set<ProjectEntity>().AnyAsync(p => p.Id == projectId);

    public Task<Dictionary<Guid, string>> GetNamesAsync(IEnumerable<Guid> projectIds)
    {
        var ids = projectIds.ToList();
        return db.Set<ProjectEntity>().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);
    }
}

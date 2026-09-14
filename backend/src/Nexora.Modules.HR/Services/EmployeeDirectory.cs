using Nexora.Modules.HR.Entities;
using Nexora.Shared.Authorization;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Services;

public class EmployeeDirectory(DbContext db) : IEmployeeDirectory
{
    public Task<bool> ExistsAsync(Guid employeeId) =>
        db.Set<Employee>().AnyAsync(e => e.Id == employeeId);

    public async Task<string?> GetDisplayNameAsync(Guid employeeId)
    {
        var employee = await db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == employeeId);
        return employee is null ? null : $"{employee.FirstName} {employee.LastName}";
    }

    public Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> employeeIds)
    {
        var ids = employeeIds.ToList();
        return db.Set<Employee>()
            .Where(e => ids.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
    }
}

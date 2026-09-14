using Nexora.Modules.Identity.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Identity.Services;

// The single place "what role is this person right now" gets answered. For anyone with
// a linked Employee record, the answer is always their *current* Job Title's mapped
// SystemRole — never a snapshot taken at account-creation time — so remapping a Job
// Title (e.g. "SENIOR MANAGER" -> Manager) takes effect for every employee holding it
// on their very next login, with no manual per-account fix-up ever required again.
// Only accounts with no linked Employee (SuperAdmin, a freshly-provisioned tenant's
// first Admin before HR finishes their employee record) fall back to the stored
// AspNetUserRoles assignment, since there's no Job Title to derive a role from.
public static class EffectiveRoleResolver
{
    public static async Task<string?> ResolveAsync(NexoraDbContext db, UserManager<AppUser> userManager, AppUser user)
    {
        if (user.EmployeeId is { } employeeId)
        {
            var employee = await db.Employees.IgnoreQueryFilters().FirstOrDefaultAsync(e => e.Id == employeeId);
            if (employee is not null)
            {
                var jobTitle = await db.JobTitles.IgnoreQueryFilters().FirstOrDefaultAsync(j => j.Id == employee.JobTitleId);
                if (jobTitle is not null) return jobTitle.SystemRole;
            }
        }

        var roles = await userManager.GetRolesAsync(user);
        return roles.FirstOrDefault();
    }
}

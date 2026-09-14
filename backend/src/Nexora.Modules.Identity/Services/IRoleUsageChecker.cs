namespace Nexora.Modules.Identity.Services;

// RolesController needs to know "how many Job Titles map to this role" and "is any Job
// Title still mapped to this role" — but Job Title is an HR-module concept. Defining the
// abstraction here (implemented by HR, see JobTitleRoleUsageChecker) lets Identity depend
// only on this interface instead of referencing the HR module directly, which would create
// a project-reference cycle (HR already depends on Identity for AppUser/AppRole/Permission).
public interface IRoleUsageChecker
{
    Task<Dictionary<string, int>> CountByRoleNameAsync();
    Task<bool> IsRoleInUseAsync(string roleName);
}

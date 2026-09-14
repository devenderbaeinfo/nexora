namespace Nexora.Shared.Authorization;

// TimesheetsController (HR) needs to validate a Project id and show its name, but Project is
// a Projects-module concept. Projects already depends on HR for Employee, so a direct
// reference the other way would create a project-reference cycle — this Guid/string-only
// abstraction (implemented by Projects, see ProjectDirectory) breaks it.
public interface IProjectDirectory
{
    Task<bool> ExistsAsync(Guid projectId);
    Task<Dictionary<Guid, string>> GetNamesAsync(IEnumerable<Guid> projectIds);
}

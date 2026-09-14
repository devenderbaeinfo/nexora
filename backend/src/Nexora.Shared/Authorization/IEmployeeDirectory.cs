namespace Nexora.Shared.Authorization;

// Several controllers outside HR need to resolve an Employee id to a display name (or check
// it exists) — ApprovalSettingsController's fallback approver, AccountingController's journal
// "posted by" names — but Employee is an HR-module concept. Living here (a pure Guid/string
// abstraction, no Employee type involved) lets any module depend on it without a direct
// reference to HR, which would create project-reference cycles (HR itself depends on
// Workflow for approvals and on Projects for timesheets).
public interface IEmployeeDirectory
{
    Task<bool> ExistsAsync(Guid employeeId);
    Task<string?> GetDisplayNameAsync(Guid employeeId);
    Task<Dictionary<Guid, string>> GetDisplayNamesAsync(IEnumerable<Guid> employeeIds);
}

using Nexora.Shared.Common;

namespace Nexora.Modules.Identity.Entities;

// Configured per (ReportKey), tenant-wide. No row for a given ReportKey means "unrestricted" —
// the same "no configured rows = unrestricted" default-open philosophy PermissionScope/
// RoleFieldPermission already use, so a tenant that never touches the Report Access admin page
// sees no change from today's flat Permission.Reports.* claim check. The moment ANY grant row
// exists for a ReportKey, that report flips to allowlisted: only a role/user with a matching
// row (and who still holds the base Permission.Reports.* claim) can access it — see
// IReportAccessService for the resolution logic that reads this table.
public class ReportAccessGrant : TenantEntity
{
    // Grant to everyone holding this role, OR to one specific user (AppUser id) — exactly one
    // of RoleId/UserId must be set, enforced in ReportAccessController rather than here (an EF
    // entity has no natural place for a cross-field CHECK constraint in this codebase's style).
    public Guid? RoleId { get; set; }
    public Guid? UserId { get; set; }

    // Matches a Permission.Reports.* key, e.g. "reports.view_projects".
    public string ReportKey { get; set; } = default!;

    // Optional — narrows the grant to one specific project's data (only meaningful for
    // reports.view_projects today). Null means "all projects the base permission+scope already
    // allows" — no additional restriction beyond the existing ProjectManagerId ownership filter.
    public Guid? ProjectId { get; set; }
}

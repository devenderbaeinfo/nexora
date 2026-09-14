using System.Security.Claims;
using Nexora.Modules.Identity.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Api.Authorization;

// Resolves the admin-configurable "who can see this report" layer on top of the flat
// Permission.Reports.* claim check — see IReportAccessService and ReportAccessGrant for the
// semantics. Never trust a client-supplied role/user id: every check here reads the caller's
// own claims from the JWT (role_id + sub, set at login, can't be spoofed without the signing key).
public class ReportAccessService : IReportAccessService
{
    private readonly NexoraDbContext _db;
    public ReportAccessService(NexoraDbContext db) => _db = db;

    private static Guid? CurrentUserIdOf(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id) ? id : null;

    private static List<Guid> RoleIdsOf(ClaimsPrincipal user) =>
        user.Claims.Where(c => c.Type == "role_id")
            .Select(c => Guid.TryParse(c.Value, out var id) ? id : (Guid?)null)
            .Where(id => id is not null)
            .Select(id => id!.Value)
            .ToList();

    public async Task<ReportAccessDecision> ResolveAsync(ClaimsPrincipal user, string reportKey)
    {
        // The ReportAccessGrant table only ever narrows — without the underlying Reports.*
        // permission claim itself, no grant (and no absence of one) can grant access.
        if (!user.HasClaim("perm", reportKey)) return ReportAccessDecision.Denied;

        var anyConfigured = await _db.ReportAccessGrants.AnyAsync(g => g.ReportKey == reportKey);
        if (!anyConfigured) return ReportAccessDecision.Unrestricted;

        var roleIds = RoleIdsOf(user);
        var userId = CurrentUserIdOf(user);

        var matching = await _db.ReportAccessGrants
            .Where(g => g.ReportKey == reportKey
                && ((g.RoleId != null && roleIds.Contains(g.RoleId.Value)) || (userId != null && g.UserId == userId)))
            .ToListAsync();

        if (matching.Count == 0) return ReportAccessDecision.Denied;

        // Project-scoping is an intersection with whatever ownership filtering the controller
        // already applies (ProjectManagerId == me), not a replacement for it — see
        // IReportAccessService.ResolveAsync's doc comment and ReportsController.Projects.
        // If ANY matching grant is role-/user-wide (ProjectId == null), that alone means "don't
        // restrict by project" even if other matching grants for the same key do set one — a
        // broader grant should never be narrowed by a separate, more specific one also held.
        var hasUnrestrictedProjectGrant = matching.Any(g => g.ProjectId is null);
        var projectIds = hasUnrestrictedProjectGrant
            ? null
            : matching.Where(g => g.ProjectId is not null).Select(g => g.ProjectId!.Value).Distinct().ToList();

        return new ReportAccessDecision(true, projectIds);
    }

    public async Task<bool> CanAccessAsync(ClaimsPrincipal user, string reportKey, Guid? projectId = null)
    {
        var decision = await ResolveAsync(user, reportKey);
        if (!decision.Allowed) return false;
        if (projectId is null || decision.ProjectIds is null) return true;
        return decision.ProjectIds.Contains(projectId.Value);
    }
}

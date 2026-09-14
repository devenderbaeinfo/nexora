using System.Security.Claims;

namespace Nexora.Modules.Identity.Authorization;

// Allowed: whether the caller can see this report at all. ProjectIds: when non-null, the set
// of project ids their grant(s) narrow them to (see ReportAccessGrant.ProjectId) — the caller
// should intersect this with whatever ownership filtering it already does (e.g.
// ProjectManagerId == me), never treat it as a replacement for that filtering.
public record ReportAccessDecision(bool Allowed, IReadOnlyList<Guid>? ProjectIds)
{
    public static readonly ReportAccessDecision Denied = new(false, null);
    public static readonly ReportAccessDecision Unrestricted = new(true, null);
}

// Abstraction lives in the Identity module (it already owns ReportAccessGrant/Permission.Reports)
// so every other module — Reporting in particular — can depend on it without a project reference
// to Nexora.Api, which owns the concrete DbContext. Same split as IDataScopeService/DataScopeService.
public interface IReportAccessService
{
    Task<ReportAccessDecision> ResolveAsync(ClaimsPrincipal user, string reportKey);

    // Convenience wrapper: false if the base claim is missing, if a ReportAccessGrant allowlist
    // exists for this key and the caller has no matching row, or if projectId is given and the
    // caller's grants narrow them to a different set of projects.
    Task<bool> CanAccessAsync(ClaimsPrincipal user, string reportKey, Guid? projectId = null);
}

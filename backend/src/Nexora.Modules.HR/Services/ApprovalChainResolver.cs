using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Workflow.Entities;

namespace Nexora.Modules.HR.Services;

// One resolved stage of whichever chain applies to a given employee — either read from a
// tenant's custom ApprovalChainStage rows, or (when no custom chain exists at all) the
// hardcoded Manager->HR default, expressed in the same shape so callers don't need to branch.
public record ResolvedApprovalStage(
    int Order, string StageName, bool IsHrStage,
    ApproverResolutionType ResolutionType, Guid? ApproverEmployeeId, Guid? ApproverRoleId);

public record ResolvedApprovalChain(Guid? ChainDefinitionId, IReadOnlyList<ResolvedApprovalStage> Stages);

public interface IApprovalChainResolver
{
    // Which chain applies to this employee right now, most-specific-scope-wins (JobTitle > Role
    // > Global). ChainDefinitionId is null when nothing has been configured for this tenant at
    // all — callers should treat that as "use the hardcoded Manager/HR path unchanged" rather
    // than driving the generic per-stage flow off Stages (which is still populated, for callers
    // that want it uniformly).
    Task<ResolvedApprovalChain> ResolveChainAsync(Guid employeeId);

    // Which employees are eligible to act on this stage for this specific request's employee.
    // Never throws on "no manager"/"no skip-level manager" — falls back to
    // TenantApprovalSettings.FallbackApproverEmployeeId (same as today), and returns an empty
    // set (not an error) if even that isn't configured.
    Task<HashSet<Guid>> ResolveApproverEmployeeIdsAsync(ResolvedApprovalStage stage, Guid requestingEmployeeId);
}

public class ApprovalChainResolver : IApprovalChainResolver
{
    private readonly DbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public ApprovalChainResolver(DbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // The hardcoded default every tenant sees until an Admin configures something: one manager
    // stage (ReportingManager) then one HR stage (RoleHolders is not how HR is resolved today —
    // HR stays gated by the flat Permission.Leave.ApproveAsHr claim, handled entirely outside
    // this resolver by LeaveRequestsController's existing DecideAsHr path).
    private static readonly ResolvedApprovalStage[] DefaultStages =
    [
        new(0, "Manager", false, ApproverResolutionType.ReportingManager, null, null),
        new(1, "HR", true, ApproverResolutionType.RoleHolders, null, null),
    ];

    public async Task<ResolvedApprovalChain> ResolveChainAsync(Guid employeeId)
    {
        var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return new ResolvedApprovalChain(null, DefaultStages);

        Guid? effectiveRoleId = null;
        var appUser = await _db.Set<AppUser>().FirstOrDefaultAsync(u => u.EmployeeId == employeeId);
        if (appUser is not null)
        {
            var roleName = await EffectiveRoleResolver.ResolveAsync(_db, _userManager, appUser);
            if (roleName is not null)
            {
                effectiveRoleId = await _db.Set<AppRole>().IgnoreQueryFilters()
                    .Where(r => r.TenantId == employee.TenantId && r.Name == roleName)
                    .Select(r => (Guid?)r.Id).FirstOrDefaultAsync();
            }
        }

        var candidates = await _db.Set<ApprovalChainDefinition>()
            .Where(c => c.EntityType == WorkflowDefinitions.LeaveRequest && c.IsActive)
            .ToListAsync();

        // JobTitle-scope beats Role-scope beats the tenant's single Global definition —
        // documented precedence, see ApprovalChainDefinition's own doc comment.
        var match =
            candidates.FirstOrDefault(c => c.ScopeType == ApprovalChainScopeType.JobTitle && c.ScopeKey == employee.JobTitleId) ??
            (effectiveRoleId is { } roleId ? candidates.FirstOrDefault(c => c.ScopeType == ApprovalChainScopeType.Role && c.ScopeKey == roleId) : null) ??
            candidates.FirstOrDefault(c => c.ScopeType == ApprovalChainScopeType.Global);

        if (match is null) return new ResolvedApprovalChain(null, DefaultStages);

        var stages = await _db.Set<ApprovalChainStage>()
            .Where(s => s.ChainDefinitionId == match.Id)
            .OrderBy(s => s.StageOrder)
            .Select(s => new ResolvedApprovalStage(s.StageOrder, s.StageName, s.IsHrStage, s.ResolutionType, s.ApproverEmployeeId, s.ApproverRoleId))
            .ToListAsync();

        if (stages.Count == 0) return new ResolvedApprovalChain(null, DefaultStages);

        return new ResolvedApprovalChain(match.Id, stages);
    }

    public async Task<HashSet<Guid>> ResolveApproverEmployeeIdsAsync(ResolvedApprovalStage stage, Guid requestingEmployeeId)
    {
        switch (stage.ResolutionType)
        {
            case ApproverResolutionType.SpecificEmployee:
                return stage.ApproverEmployeeId is { } specific ? [specific] : [];

            case ApproverResolutionType.ReportingManager:
            {
                var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == requestingEmployeeId);
                if (employee?.ReportingManagerId is { } managerId) return [managerId];
                return await FallbackSetAsync();
            }

            case ApproverResolutionType.SkipLevelManager:
            {
                var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == requestingEmployeeId);
                if (employee?.ReportingManagerId is not { } managerId) return await FallbackSetAsync();
                var manager = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == managerId);
                if (manager?.ReportingManagerId is { } skipLevelId) return [skipLevelId];
                return await FallbackSetAsync();
            }

            case ApproverResolutionType.RoleHolders:
            {
                if (stage.ApproverRoleId is not { } roleId) return [];
                var role = await _db.Set<AppRole>().IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == roleId);
                if (role?.Name is null) return [];

                // Batch equivalent of EffectiveRoleResolver: for every employee-linked account,
                // the effective role is their current Job Title's mapped SystemRole (accounts
                // with no linked employee can't be leave approvers, so the AspNetUserRoles-only
                // fallback branch of EffectiveRoleResolver is irrelevant here).
                var jobTitleIds = await _db.Set<JobTitle>()
                    .Where(j => j.SystemRole == role.Name)
                    .Select(j => j.Id).ToListAsync();
                if (jobTitleIds.Count == 0) return [];

                var employeeIds = await _db.Set<Employee>()
                    .Where(e => jobTitleIds.Contains(e.JobTitleId))
                    .Select(e => e.Id).ToListAsync();
                return employeeIds.ToHashSet();
            }

            case ApproverResolutionType.Fallback:
                return await FallbackSetAsync();

            default:
                return [];
        }
    }

    private async Task<HashSet<Guid>> FallbackSetAsync()
    {
        var fallbackId = (await _db.Set<TenantApprovalSettings>().FirstOrDefaultAsync())?.FallbackApproverEmployeeId;
        return fallbackId is { } id ? [id] : [];
    }
}

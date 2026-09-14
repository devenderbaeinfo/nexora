using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Shared.Common;
using Nexora.Modules.Reporting.Contracts;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Projects.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Reporting.Controllers;

// Admin-only CRUD over ReportAccessGrant — the "who beyond the base Permission.Reports.* claim
// can see this report" allowlist an Admin configures on the Report Access admin page. Gated by
// the same Admin.ManageRoles permission RolesController uses, since this is the same kind of
// tenant-wide access configuration, just for reports instead of role permission sets.
[ApiController]
[Authorize]
[Route("api/report-access")]
public class ReportAccessController : ControllerBase
{
    private readonly DbContext _db;
    public ReportAccessController(DbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id")!);

    // Friendly labels for the six Permission.Reports.* keys — kept as an explicit map (rather
    // than reflecting over Permission.Reports the way Permission.Catalog() does) since every
    // entry here also needs a human-readable label, not just the raw key.
    private static readonly Dictionary<string, string> ReportLabels = new()
    {
        [Permission.Reports.ViewTeam] = "Team report (a manager's direct reports)",
        [Permission.Reports.ViewProjects] = "Projects report",
        [Permission.Reports.ViewExpenses] = "Team expenses report (manager-scoped)",
        [Permission.Reports.ViewFinance] = "Tenant-wide expenses report (Finance)",
        [Permission.Reports.ViewDashboardKpis] = "Dashboard KPI row",
        [Permission.Reports.ViewHrTrends] = "HR trends (headcount & attendance)",
    };

    [HttpGet("catalog")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public ActionResult<List<ReportKeyCatalogItemDto>> Catalog() =>
        Ok(ReportLabels.Select(kv => new ReportKeyCatalogItemDto(kv.Key, kv.Value)).ToList());

    [HttpGet]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<ActionResult<List<ReportAccessGrantDto>>> List()
    {
        var grants = await _db.Set<ReportAccessGrant>().OrderByDescending(g => g.CreatedAtUtc).ToListAsync();

        var roleIds = grants.Where(g => g.RoleId != null).Select(g => g.RoleId!.Value).Distinct().ToList();
        var roleNames = await _db.Set<AppRole>().IgnoreQueryFilters()
            .Where(r => roleIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Name!);

        var userIds = grants.Where(g => g.UserId != null).Select(g => g.UserId!.Value).Distinct().ToList();
        var users = await _db.Set<AppUser>().IgnoreQueryFilters().Where(u => userIds.Contains(u.Id)).ToListAsync();
        var employeeIds = users.Where(u => u.EmployeeId != null).Select(u => u.EmployeeId!.Value).ToList();
        var employeeNames = await _db.Set<Employee>()
            .Where(e => employeeIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
        var userNames = users.ToDictionary(u => u.Id, u =>
            u.EmployeeId != null && employeeNames.TryGetValue(u.EmployeeId.Value, out var name) ? name : (u.Email ?? "Unknown"));

        var projectIds = grants.Where(g => g.ProjectId != null).Select(g => g.ProjectId!.Value).Distinct().ToList();
        var projectNames = await _db.Set<ProjectEntity>()
            .Where(p => projectIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);

        return Ok(grants.Select(g => new ReportAccessGrantDto(
            g.Id,
            g.RoleId, g.RoleId != null ? roleNames.GetValueOrDefault(g.RoleId.Value) : null,
            g.UserId, g.UserId != null ? userNames.GetValueOrDefault(g.UserId.Value) : null,
            g.ReportKey,
            g.ProjectId, g.ProjectId != null ? projectNames.GetValueOrDefault(g.ProjectId.Value) : null)).ToList());
    }

    [HttpPost]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> Create(CreateReportAccessGrantRequest request)
    {
        if (!ReportLabels.ContainsKey(request.ReportKey)) return BadRequest("Unknown report key.");

        var hasRole = request.RoleId is not null;
        var hasUser = request.UserId is not null;
        if (hasRole == hasUser) return BadRequest("Exactly one of RoleId or UserId must be set.");

        if (hasRole)
        {
            var roleExists = await _db.Set<AppRole>().IgnoreQueryFilters()
                .AnyAsync(r => r.Id == request.RoleId && r.TenantId == TenantId);
            if (!roleExists) return BadRequest("Unknown role.");
        }
        else
        {
            var userExists = await _db.Set<AppUser>().IgnoreQueryFilters()
                .AnyAsync(u => u.Id == request.UserId && u.TenantId == TenantId);
            if (!userExists) return BadRequest("Unknown user.");
        }

        if (request.ProjectId is not null)
        {
            var projectExists = await _db.Set<ProjectEntity>().AnyAsync(p => p.Id == request.ProjectId);
            if (!projectExists) return BadRequest("Unknown project.");
        }

        var grant = new ReportAccessGrant
        {
            RoleId = request.RoleId,
            UserId = request.UserId,
            ReportKey = request.ReportKey,
            ProjectId = request.ProjectId,
        };
        _db.Set<ReportAccessGrant>().Add(grant);

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "report_access.grant",
            EntityType = "ReportAccessGrant",
            EntityId = grant.Id,
            Metadata = $"{{\"reportKey\":\"{request.ReportKey}\"}}",
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new { id = grant.Id });
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var grant = await _db.Set<ReportAccessGrant>().FirstOrDefaultAsync(g => g.Id == id);
        if (grant is null) return NotFound();

        _db.Set<ReportAccessGrant>().Remove(grant);
        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "report_access.revoke",
            EntityType = "ReportAccessGrant",
            EntityId = id,
            Metadata = $"{{\"reportKey\":\"{grant.ReportKey}\"}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

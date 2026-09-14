using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Workflow.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Workflow.Controllers;

public record ApprovalSettingsDto(Guid? FallbackApproverEmployeeId, string? FallbackApproverName);
public record SetFallbackApproverRequest(Guid? FallbackApproverEmployeeId);

// Who covers leave/timesheet approval for an employee with no ReportingManagerId — the top
// of the org chart, or anyone else PPL-7 let through via AcknowledgeNoManager. Without this,
// such a request has no possible approver and simply never clears PendingManagerApproval.
[ApiController]
[Authorize]
[Route("api/approval-settings")]
public class ApprovalSettingsController : ControllerBase
{
    private readonly DbContext _db;
    public ApprovalSettingsController(DbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Admin.ManageOrgStructure)]
    public async Task<ActionResult<ApprovalSettingsDto>> Get()
    {
        var settings = await _db.Set<TenantApprovalSettings>().FirstOrDefaultAsync();
        var approver = settings?.FallbackApproverEmployeeId is { } id
            ? await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == id)
            : null;

        return Ok(new ApprovalSettingsDto(
            settings?.FallbackApproverEmployeeId,
            approver is null ? null : $"{approver.FirstName} {approver.LastName}"));
    }

    [HttpPut]
    [RequirePermission(Permission.Admin.ManageOrgStructure)]
    public async Task<IActionResult> Set(SetFallbackApproverRequest request)
    {
        if (request.FallbackApproverEmployeeId is { } employeeId)
        {
            var exists = await _db.Set<Employee>().AnyAsync(e => e.Id == employeeId);
            if (!exists) return BadRequest("Unknown employee.");
        }

        var settings = await _db.Set<TenantApprovalSettings>().FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new TenantApprovalSettings();
            _db.Set<TenantApprovalSettings>().Add(settings);
        }
        settings.FallbackApproverEmployeeId = request.FallbackApproverEmployeeId;

        await _db.SaveChangesAsync();
        return NoContent();
    }
}

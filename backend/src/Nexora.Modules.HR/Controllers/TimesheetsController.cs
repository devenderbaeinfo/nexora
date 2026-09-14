using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.HR.Contracts;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

// Single-stage approval, unlike Leave/Reimbursement's Manager->HR/Finance chain: a timesheet
// entry only ever needs its own reporting manager's sign-off, so this doesn't go through
// ApprovalWorkflowService — TimesheetStatus itself (Draft/Submitted/Approved/Rejected) is
// the whole state machine.
[ApiController]
[Authorize]
[Route("api/timesheets")]
public class TimesheetsController : ControllerBase
{
    private readonly DbContext _db;
    private readonly IProjectDirectory _projects;
    public TimesheetsController(DbContext db, IProjectDirectory projects)
    {
        _db = db;
        _projects = projects;
    }

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("mine")]
    [RequirePermission(Permission.Timesheet.View)]
    public async Task<ActionResult<List<TimesheetEntryDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<TimesheetEntryDto>());
        return Ok(await BuildDtos(_db.Set<TimesheetEntry>()
            .Where(t => t.EmployeeId == employeeId)
            .OrderByDescending(t => t.WorkDate)
            .Take(30)));
    }

    [HttpGet("pending-approval")]
    [RequirePermission(Permission.Timesheet.Approve)]
    public async Task<ActionResult<List<TimesheetEntryDto>>> PendingApproval()
    {
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<TimesheetEntryDto>());

        var directReportIds = await _db.Set<Employee>()
            .Where(e => e.ReportingManagerId == managerId)
            .Select(e => e.Id)
            .ToListAsync();

        return Ok(await BuildDtos(_db.Set<TimesheetEntry>()
            .Where(t => directReportIds.Contains(t.EmployeeId) && t.Status == TimesheetStatus.Submitted)));
    }

    [HttpPost]
    [RequirePermission(Permission.Timesheet.Submit)]
    public async Task<IActionResult> Submit(SubmitTimesheetRequest request)
    {
        if (CurrentEmployeeId is not { } employeeId)
            return BadRequest("This account isn't linked to an employee record yet.");

        if (request.Hours <= 0 || request.Hours > 24) return BadRequest("Hours must be between 0 and 24.");

        var projectExists = await _projects.ExistsAsync(request.ProjectId);
        if (!projectExists) return BadRequest("Unknown project.");

        var entry = new TimesheetEntry
        {
            EmployeeId = employeeId,
            ProjectId = request.ProjectId,
            WorkDate = request.WorkDate,
            Hours = request.Hours,
            IsBillable = request.IsBillable,
            Notes = request.Notes,
            Status = TimesheetStatus.Submitted,
        };
        _db.Set<TimesheetEntry>().Add(entry);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Mine), null);
    }

    [HttpPost("{id:guid}/decision")]
    [RequirePermission(Permission.Timesheet.Approve)]
    public async Task<IActionResult> Decide(Guid id, DecideTimesheetRequest decision)
    {
        var entry = await _db.Set<TimesheetEntry>().FirstOrDefaultAsync(t => t.Id == id);
        if (entry is null) return NotFound();
        if (entry.Status != TimesheetStatus.Submitted) return Conflict("This entry has already been decided.");

        var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == entry.EmployeeId);
        if (employee?.ReportingManagerId != CurrentEmployeeId) return Forbid();

        entry.Status = decision.Approve ? TimesheetStatus.Approved : TimesheetStatus.Rejected;

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "timesheet.approve" : "timesheet.reject",
            EntityType = "TimesheetEntry",
            EntityId = entry.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<List<TimesheetEntryDto>> BuildDtos(IQueryable<TimesheetEntry> query)
    {
        var entries = await query.OrderByDescending(t => t.WorkDate).ToListAsync();
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
        var projects = await _projects.GetNamesAsync(entries.Select(t => t.ProjectId));

        return entries.Select(t => new TimesheetEntryDto(
            t.Id,
            employees.TryGetValue(t.EmployeeId, out var name) ? name : "—",
            projects.TryGetValue(t.ProjectId, out var pName) ? pName : "—",
            t.WorkDate, t.Hours, t.IsBillable, t.Notes, t.Status.ToString())).ToList();
    }
}

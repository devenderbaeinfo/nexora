using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.HR.Contracts;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

[ApiController]
[Authorize]
[Route("api/attendance")]
public class AttendanceController : ControllerBase
{
    // Fallback used only when a tenant has never set its own value — matches the default on
    // TenantAttendanceSettings.StandardWorkDayHours so a tenant that never configures this sees
    // no behavior change from before that setting existed.
    private const decimal DefaultStandardWorkDayHours = 8m;

    private readonly NexoraDbContext _db;
    public AttendanceController(NexoraDbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private async Task<decimal> StandardWorkDayHoursAsync() =>
        (await _db.TenantAttendanceSettings.FirstOrDefaultAsync())?.StandardWorkDayHours ?? DefaultStandardWorkDayHours;

    // Tenant-wide operational config, same permission as the fallback-approver setting
    // (Permission.Admin.ManageOrgStructure) — both configure "how this org's approvals/hours
    // work" rather than any one person's own record.
    [HttpGet("settings")]
    [RequirePermission(Permission.Admin.ManageOrgStructure)]
    public async Task<ActionResult<AttendanceSettingsDto>> GetSettings() =>
        Ok(new AttendanceSettingsDto(await StandardWorkDayHoursAsync()));

    [HttpPut("settings")]
    [RequirePermission(Permission.Admin.ManageOrgStructure)]
    public async Task<IActionResult> SetSettings(UpdateAttendanceSettingsRequest request)
    {
        if (request.StandardWorkDayHours is <= 0 or > 24)
            return BadRequest("Standard workday hours must be between 0 and 24.");

        var settings = await _db.TenantAttendanceSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new TenantAttendanceSettings();
            _db.TenantAttendanceSettings.Add(settings);
        }
        settings.StandardWorkDayHours = request.StandardWorkDayHours;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("mine")]
    [RequirePermission(Permission.Attendance.ClockInOut)]
    public async Task<ActionResult<List<AttendanceEntryDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<AttendanceEntryDto>());
        return Ok(await BuildDtos(_db.AttendanceEntries
            .Where(a => a.EmployeeId == employeeId)
            .OrderByDescending(a => a.WorkDate)
            .Take(30)));
    }

    // HR-wide view for a single day (defaults to today) — the daily dashboard, not a full history.
    [HttpGet]
    [RequirePermission(Permission.Attendance.ViewAll)]
    public async Task<ActionResult<List<AttendanceEntryDto>>> ForDate([FromQuery] DateOnly? date)
    {
        var workDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        return Ok(await BuildDtos(_db.AttendanceEntries.Where(a => a.WorkDate == workDate)));
    }

    // A manager's own team, scoped by ReportingManagerId rather than company-wide —
    // the Manager-role equivalent of ForDate above, which only HR/Admin can call.
    [HttpGet("team")]
    [RequirePermission(Permission.Attendance.ViewTeam)]
    public async Task<ActionResult<List<AttendanceEntryDto>>> Team([FromQuery] DateOnly? date)
    {
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<AttendanceEntryDto>());

        var workDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var directReportIds = await _db.Employees
            .Where(e => e.ReportingManagerId == managerId)
            .Select(e => e.Id)
            .ToListAsync();

        return Ok(await BuildDtos(_db.AttendanceEntries.Where(a => a.WorkDate == workDate && directReportIds.Contains(a.EmployeeId))));
    }

    [HttpPost("clock-in")]
    [RequirePermission(Permission.Attendance.ClockInOut)]
    public async Task<IActionResult> ClockIn()
    {
        if (CurrentEmployeeId is not { } employeeId)
            return BadRequest("This account isn't linked to an employee record yet.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var existing = await _db.AttendanceEntries.FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.WorkDate == today);
        if (existing is not null) return Conflict("Already clocked in today.");

        var entry = new AttendanceEntry
        {
            EmployeeId = employeeId,
            WorkDate = today,
            ClockIn = DateTimeOffset.UtcNow,
        };
        _db.AttendanceEntries.Add(entry);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Mine), null);
    }

    [HttpPost("clock-out")]
    [RequirePermission(Permission.Attendance.ClockInOut)]
    public async Task<IActionResult> ClockOut()
    {
        if (CurrentEmployeeId is not { } employeeId)
            return BadRequest("This account isn't linked to an employee record yet.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var entry = await _db.AttendanceEntries.FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.WorkDate == today);
        if (entry is null) return BadRequest("You haven't clocked in today.");
        if (entry.ClockOut is not null) return Conflict("Already clocked out today.");

        entry.ClockOut = DateTimeOffset.UtcNow;
        ApplyHours(entry, await StandardWorkDayHoursAsync());
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id:guid}")]
    [RequirePermission(Permission.Attendance.Correct)]
    public async Task<IActionResult> Correct(Guid id, CorrectAttendanceRequest request)
    {
        var entry = await _db.AttendanceEntries.FirstOrDefaultAsync(a => a.Id == id);
        if (entry is null) return NotFound();
        if (request.ClockOut is not null && request.ClockOut < request.ClockIn)
            return BadRequest("Clock-out can't be before clock-in.");

        entry.ClockIn = request.ClockIn;
        entry.ClockOut = request.ClockOut;
        ApplyHours(entry, await StandardWorkDayHoursAsync());

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "attendance.correct",
            EntityType = "AttendanceEntry",
            EntityId = entry.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static void ApplyHours(AttendanceEntry entry, decimal standardWorkDayHours)
    {
        if (entry.ClockOut is not { } clockOut)
        {
            entry.RegularHours = null;
            entry.OvertimeHours = null;
            return;
        }

        var hoursWorked = (decimal)(clockOut - entry.ClockIn).TotalHours;
        entry.RegularHours = Math.Min(hoursWorked, standardWorkDayHours);
        entry.OvertimeHours = Math.Max(0, hoursWorked - standardWorkDayHours);
    }

    private async Task<List<AttendanceEntryDto>> BuildDtos(IQueryable<AttendanceEntry> query)
    {
        var entries = await query.ToListAsync();
        var employees = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return entries.Select(a => new AttendanceEntryDto(
            a.Id, a.EmployeeId, employees.TryGetValue(a.EmployeeId, out var name) ? name : "—",
            a.WorkDate, a.ClockIn, a.ClockOut, a.RegularHours, a.OvertimeHours)).ToList();
    }
}

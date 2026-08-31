using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Identity;
using Erp.Domain.People;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/employees")]
public class EmployeesController : ControllerBase
{
    private readonly ErpDbContext _db;

    public EmployeesController(ErpDbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    // A manager's own team — used by "My Team" and everything downstream of it
    // (team expenses, team reports). Empty for anyone without direct reports.
    [HttpGet("direct-reports")]
    [RequirePermission(Permission.People.View)]
    public async Task<ActionResult<List<EmployeeListItem>>> DirectReports()
    {
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<EmployeeListItem>());

        var departments = await _db.Departments.ToDictionaryAsync(d => d.Id, d => d.Name);
        var jobTitles = await _db.JobTitles.ToDictionaryAsync(j => j.Id, j => j.Name);
        var employees = await _db.Employees
            .Where(e => e.ReportingManagerId == managerId)
            .OrderBy(e => e.FirstName)
            .ToListAsync();

        return Ok(employees.Select(e => new EmployeeListItem(
            e.Id, e.FirstName, e.LastName, e.WorkEmail,
            jobTitles.TryGetValue(e.JobTitleId, out var jobTitleName) ? jobTitleName : "—",
            departments.TryGetValue(e.DepartmentId, out var name) ? name : "—",
            e.Status.ToString())).ToList());
    }

    // The logged-in user's own employee record — "My Profile".
    [HttpGet("me")]
    [RequirePermission(Permission.People.View)]
    public async Task<ActionResult<EmployeeProfileDto>> Me()
    {
        if (CurrentEmployeeId is not { } employeeId) return NotFound();

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return NotFound();

        var department = await _db.Departments.FirstOrDefaultAsync(d => d.Id == employee.DepartmentId);
        var jobTitle = await _db.JobTitles.FirstOrDefaultAsync(j => j.Id == employee.JobTitleId);
        var location = employee.LocationId is { } locationId
            ? await _db.Locations.FirstOrDefaultAsync(l => l.Id == locationId)
            : null;

        return Ok(new EmployeeProfileDto(
            employee.Id, employee.FirstName, employee.LastName, employee.WorkEmail, employee.PersonalPhone,
            jobTitle?.Name ?? "—", department?.Name ?? "—", location?.Name, employee.Status.ToString(), employee.HireDate));
    }

    // No explicit tenant filter here — ErpDbContext's global query filter already
    // restricts every query on this DbContext instance to the caller's own tenant.
    [HttpGet]
    [RequirePermission(Permission.People.View)]
    public async Task<ActionResult<List<EmployeeListItem>>> List()
    {
        var departments = await _db.Departments.ToDictionaryAsync(d => d.Id, d => d.Name);
        var jobTitles = await _db.JobTitles.ToDictionaryAsync(j => j.Id, j => j.Name);

        var employees = await _db.Employees
            .OrderBy(e => e.FirstName)
            .ToListAsync();
        var namesById = employees.ToDictionary(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        var result = employees.Select(e => new EmployeeListItem(
            e.Id, e.FirstName, e.LastName, e.WorkEmail,
            jobTitles.TryGetValue(e.JobTitleId, out var jobTitleName) ? jobTitleName : "—",
            departments.TryGetValue(e.DepartmentId, out var name) ? name : "—",
            e.Status.ToString(),
            e.ReportingManagerId,
            e.ReportingManagerId is { } mgrId && namesById.TryGetValue(mgrId, out var mgrName) ? mgrName : null)).ToList();

        return Ok(result);
    }

    [HttpPost]
    [RequirePermission(Permission.People.Manage)]
    public async Task<ActionResult<EmployeeListItem>> Create(CreateEmployeeRequest request)
    {
        var departmentExists = await _db.Departments.AnyAsync(d => d.Id == request.DepartmentId);
        if (!departmentExists) return BadRequest("Unknown department.");

        var jobTitleExists = await _db.JobTitles.AnyAsync(j => j.Id == request.JobTitleId);
        if (!jobTitleExists) return BadRequest("Unknown job title.");

        var emailInUse = await _db.Employees.AnyAsync(e => e.WorkEmail == request.WorkEmail);
        if (emailInUse) return Conflict("An employee with this work email already exists.");

        var employee = new Employee
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            WorkEmail = request.WorkEmail,
            JobTitleId = request.JobTitleId,
            DepartmentId = request.DepartmentId,
            LocationId = request.LocationId,
            ReportingManagerId = request.ReportingManagerId,
            HireDate = request.HireDate,
        };

        _db.Employees.Add(employee);
        _db.EmployeeAssignmentHistories.Add(new EmployeeAssignmentHistory
        {
            EmployeeId = employee.Id,
            DepartmentId = employee.DepartmentId,
            JobTitleId = employee.JobTitleId,
            ReportingManagerId = employee.ReportingManagerId,
            EffectiveFrom = request.HireDate,
            ChangeReason = "Initial hire"
        });

        await _db.SaveChangesAsync();

        var department = await _db.Departments.FirstAsync(d => d.Id == employee.DepartmentId);
        var jobTitle = await _db.JobTitles.FirstAsync(j => j.Id == employee.JobTitleId);
        return CreatedAtAction(nameof(List), new EmployeeListItem(
            employee.Id, employee.FirstName, employee.LastName, employee.WorkEmail,
            jobTitle.Name, department.Name, employee.Status.ToString()));
    }

    // Backfills what "Add person" should have asked for at hire time. Without a reporting
    // manager, an employee's leave/timesheet/expense requests have no manager queue to ever
    // land in — this is the fix for exactly that dead end, not just a nicety.
    [HttpPatch("{id:guid}/manager")]
    [RequirePermission(Permission.People.Manage)]
    public async Task<IActionResult> SetManager(Guid id, SetReportingManagerRequest request)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();

        if (request.ReportingManagerId == id) return BadRequest("An employee can't be their own manager.");
        if (request.ReportingManagerId is { } managerId)
        {
            var managerExists = await _db.Employees.AnyAsync(e => e.Id == managerId);
            if (!managerExists) return BadRequest("Unknown manager.");
        }

        employee.ReportingManagerId = request.ReportingManagerId;
        _db.EmployeeAssignmentHistories.Add(new EmployeeAssignmentHistory
        {
            EmployeeId = employee.Id,
            DepartmentId = employee.DepartmentId,
            JobTitleId = employee.JobTitleId,
            ReportingManagerId = employee.ReportingManagerId,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
            ChangeReason = "Manager reassigned",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.Onboarding.Contracts;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Onboarding.Entities;
using Nexora.Modules.HR.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Onboarding.Controllers;

[ApiController]
[Authorize]
[Route("api/onboarding")]
public class OnboardingController : ControllerBase
{
    private readonly DbContext _db;
    public OnboardingController(DbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private bool CanManage => User.HasClaim("perm", Permission.Onboarding.Manage);

    // HR's own dashboard: every task across every employee that isn't finished yet,
    // newest plan first so a freshly started onboarding surfaces at the top.
    [HttpGet]
    [RequirePermission(Permission.Onboarding.Manage)]
    public async Task<ActionResult<List<OnboardingTaskDto>>> All()
    {
        return Ok(await BuildDtos(_db.Set<OnboardingTask>().Where(t => t.Status != OnboardingTaskStatus.Completed && t.Status != OnboardingTaskStatus.Skipped)));
    }

    // A plain employee only ever sees their own checklist — HR/Manager can see anyone's
    // by passing an employeeId, but an employee without Manage rights is pinned to themselves.
    [HttpGet("employees/{employeeId:guid}")]
    [RequirePermission(Permission.Onboarding.View)]
    public async Task<ActionResult<List<OnboardingTaskDto>>> ForEmployee(Guid employeeId)
    {
        if (!CanManage && employeeId != CurrentEmployeeId) return Forbid();
        return Ok(await BuildDtos(_db.Set<OnboardingTask>().Where(t => t.EmployeeId == employeeId)));
    }

    [HttpGet("mine")]
    [RequirePermission(Permission.Onboarding.View)]
    public async Task<ActionResult<List<OnboardingTaskDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<OnboardingTaskDto>());
        return Ok(await BuildDtos(_db.Set<OnboardingTask>().Where(t => t.EmployeeId == employeeId)));
    }

    // Employees with no onboarding plan yet — the only ones HR should be able to pick when
    // starting a new plan, so someone already onboarded (or mid-onboarding) never shows up
    // to be started again.
    [HttpGet("not-started")]
    [RequirePermission(Permission.Onboarding.Manage)]
    public async Task<ActionResult<List<Guid>>> NotStarted()
    {
        var startedIds = await _db.Set<OnboardingTask>().Select(t => t.EmployeeId).Distinct().ToListAsync();
        var eligible = await _db.Set<Employee>()
            .Where(e => !startedIds.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync();
        return Ok(eligible);
    }

    // Seeds the default checklist for a new hire. Safe to call again later if HR wants to
    // top up a plan that was somehow left empty — it's a no-op once tasks already exist.
    [HttpPost("start")]
    [RequirePermission(Permission.Onboarding.Manage)]
    public async Task<IActionResult> Start(StartOnboardingRequest request)
    {
        var employeeExists = await _db.Set<Employee>().AnyAsync(e => e.Id == request.EmployeeId);
        if (!employeeExists) return BadRequest("Unknown employee.");

        var alreadyStarted = await _db.Set<OnboardingTask>().AnyAsync(t => t.EmployeeId == request.EmployeeId);
        if (alreadyStarted) return Conflict("This employee already has an onboarding plan.");

        foreach (var (title, category) in OnboardingDefaultTemplate.Items)
        {
            _db.Set<OnboardingTask>().Add(new OnboardingTask
            {
                EmployeeId = request.EmployeeId,
                Title = title,
                Category = category,
            });
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "onboarding.start",
            EntityType = "Employee",
            EntityId = request.EmployeeId,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("tasks")]
    [RequirePermission(Permission.Onboarding.Manage)]
    public async Task<IActionResult> AddTask(AddOnboardingTaskRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest("Title is required.");

        var employeeExists = await _db.Set<Employee>().AnyAsync(e => e.Id == request.EmployeeId);
        if (!employeeExists) return BadRequest("Unknown employee.");

        var task = new OnboardingTask
        {
            EmployeeId = request.EmployeeId,
            Title = request.Title,
            Description = request.Description,
            Category = request.Category,
            DueDate = request.DueDate,
        };
        _db.Set<OnboardingTask>().Add(task);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(ForEmployee), new { employeeId = request.EmployeeId }, null);
    }

    [HttpPatch("tasks/{id:guid}")]
    [RequirePermission(Permission.Onboarding.Manage)]
    public async Task<IActionResult> UpdateTask(Guid id, UpdateOnboardingTaskRequest request)
    {
        var task = await _db.Set<OnboardingTask>().FirstOrDefaultAsync(t => t.Id == id);
        if (task is null) return NotFound();

        task.Status = request.Status;
        task.Notes = request.Notes;
        task.CompletedAtUtc = request.Status == OnboardingTaskStatus.Completed ? DateTimeOffset.UtcNow : null;

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "onboarding.update_task",
            EntityType = "OnboardingTask",
            EntityId = task.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<List<OnboardingTaskDto>> BuildDtos(IQueryable<OnboardingTask> query)
    {
        var tasks = await query.OrderBy(t => t.DueDate).ThenBy(t => t.CreatedAtUtc).ToListAsync();
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return tasks.Select(t => new OnboardingTaskDto(
            t.Id, t.EmployeeId, employees.TryGetValue(t.EmployeeId, out var name) ? name : "—",
            t.Title, t.Description, t.Category.ToString(), t.Status.ToString(),
            t.DueDate, t.CompletedAtUtc, t.Notes)).ToList();
    }
}

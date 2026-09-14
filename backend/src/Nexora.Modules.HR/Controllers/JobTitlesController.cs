using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.HR.Contracts;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Identity.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

[ApiController]
[Authorize]
[Route("api/job-titles")]
public class JobTitlesController : ControllerBase
{
    private readonly DbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public JobTitlesController(DbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // Confirms the caller resolves to a real, recognized creator role (Admin or HR) at all —
    // NOT the "who can create whom" boundary itself. Which role a Job Title may be labeled
    // with is deliberately broader than that (see AssignableRoleResolver.AllTaggableRoleNamesAsync):
    // HR can tag a Job Title with any role Admin has defined, including a custom one, since
    // that's org-chart metadata, not a hiring action. UsersController.Create still enforces
    // the actual privilege boundary independently when someone is hired into that title.
    private async Task<string?> CurrentCreatorRoleAsync()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return null;

        var role = await EffectiveRoleResolver.ResolveAsync(_db, _userManager, user);
        return role is not null && RoleTemplates.AssignableRolesByCreatorRole.ContainsKey(role) ? role : null;
    }

    [HttpGet]
    [RequirePermission(Permission.People.View)]
    public async Task<ActionResult<List<JobTitleDto>>> List()
    {
        var titles = await _db.Set<JobTitle>().OrderBy(j => j.Name).ToListAsync();
        return Ok(titles.Select(j => new JobTitleDto(j.Id, j.Name, j.SystemRole)).ToList());
    }

    // Deliberately separate from GET /users/assignable-roles — that one governs who a caller
    // may actually *hire* into (narrow, creator-scoped) and must stay that way. This one
    // governs what a Job Title may be *labeled* with (broad: every role Admin has defined,
    // system or custom) — see AllTaggableRoleNamesAsync.
    [HttpGet("assignable-roles")]
    [RequirePermission(Permission.People.Manage)]
    public async Task<ActionResult<string[]>> AssignableRoles() =>
        Ok(await AssignableRoleResolver.AllTaggableRoleNamesAsync(_db, TenantId));

    // "HR can create new role" — a tenant's job-title list grows as HR needs it to
    // (Intern, Developer, Senior Developer, ...), not fixed at provisioning time.
    [HttpPost]
    [RequirePermission(Permission.People.Manage)]
    public async Task<ActionResult<JobTitleDto>> Create(CreateJobTitleRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");
        if (name.Length > 200) return BadRequest("Name can't be longer than 200 characters.");

        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Forbid();
        if (!(await AssignableRoleResolver.AllTaggableRoleNamesAsync(_db, TenantId)).Contains(request.SystemRole))
        {
            return Forbid();
        }

        var exists = await _db.Set<JobTitle>().AnyAsync(j => j.Name == name);
        if (exists) return Conflict("A job title with this name already exists.");

        var jobTitle = new JobTitle { Name = name, SystemRole = request.SystemRole };
        _db.Set<JobTitle>().Add(jobTitle);

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "job_title.create",
            EntityType = "JobTitle",
            EntityId = jobTitle.Id,
            Metadata = $"{{\"name\":\"{name}\",\"systemRole\":\"{request.SystemRole}\"}}",
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new JobTitleDto(jobTitle.Id, jobTitle.Name, jobTitle.SystemRole));
    }

    // Every job title's role mapping is resolved live at login (EffectiveRoleResolver), so
    // this single field controls what everyone holding that title can do — the exact kind of
    // change that used to happen by hand in SQL. It's worth an audit trail on its own.
    [HttpPatch("{id:guid}")]
    [RequirePermission(Permission.People.Manage)]
    public async Task<ActionResult<JobTitleDto>> Update(Guid id, UpdateJobTitleRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");
        if (name.Length > 200) return BadRequest("Name can't be longer than 200 characters.");

        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Forbid();
        if (!(await AssignableRoleResolver.AllTaggableRoleNamesAsync(_db, TenantId)).Contains(request.SystemRole))
        {
            return Forbid();
        }

        var jobTitle = await _db.Set<JobTitle>().FirstOrDefaultAsync(j => j.Id == id);
        if (jobTitle is null) return NotFound();

        var nameTaken = await _db.Set<JobTitle>().AnyAsync(j => j.Id != id && j.Name == name);
        if (nameTaken) return Conflict("A job title with this name already exists.");

        var previousName = jobTitle.Name;
        var previousRole = jobTitle.SystemRole;
        jobTitle.Name = name;
        jobTitle.SystemRole = request.SystemRole;

        if (previousRole != request.SystemRole)
        {
            _db.Set<AuditLog>().Add(new AuditLog
            {
                ActorUserId = CurrentUserId,
                Action = "job_title.role_remap",
                EntityType = "JobTitle",
                EntityId = jobTitle.Id,
                Metadata = $"{{\"name\":\"{name}\",\"from\":\"{previousRole}\",\"to\":\"{request.SystemRole}\"}}",
            });
        }
        if (previousName != name)
        {
            _db.Set<AuditLog>().Add(new AuditLog
            {
                ActorUserId = CurrentUserId,
                Action = "job_title.rename",
                EntityType = "JobTitle",
                EntityId = jobTitle.Id,
                Metadata = $"{{\"from\":\"{previousName}\",\"to\":\"{name}\"}}",
            });
        }
        await _db.SaveChangesAsync();

        return Ok(new JobTitleDto(jobTitle.Id, jobTitle.Name, jobTitle.SystemRole));
    }

    // Only a job title nothing currently uses can be deleted — one still held by an employee
    // would leave EmployeeContracts/People pointing at a JobTitleId that no longer resolves to
    // anything (same reasoning as RolesController.Delete's "still mapped/assigned" guards).
    [HttpDelete("{id:guid}")]
    [RequirePermission(Permission.People.Manage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var jobTitle = await _db.Set<JobTitle>().FirstOrDefaultAsync(j => j.Id == id);
        if (jobTitle is null) return NotFound();

        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Forbid();
        if (!(await AssignableRoleResolver.AllTaggableRoleNamesAsync(_db, TenantId)).Contains(jobTitle.SystemRole))
        {
            return Forbid();
        }

        var inUse = await _db.Set<Employee>().AnyAsync(e => e.JobTitleId == id);
        if (inUse) return Conflict("This job title is still held by one or more employees.");

        _db.Set<JobTitle>().Remove(jobTitle);

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "job_title.delete",
            EntityType = "JobTitle",
            EntityId = jobTitle.Id,
            Metadata = $"{{\"name\":\"{jobTitle.Name}\",\"systemRole\":\"{jobTitle.SystemRole}\"}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id")!);
}

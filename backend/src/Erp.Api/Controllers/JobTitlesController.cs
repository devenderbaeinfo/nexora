using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Audit;
using Erp.Domain.Identity;
using Erp.Domain.People;
using Erp.Infrastructure.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/job-titles")]
public class JobTitlesController : ControllerBase
{
    private readonly ErpDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public JobTitlesController(ErpDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // Same "who can create whom" boundary as UsersController — a Job Title mapped to a
    // system role is exactly as powerful as creating a user in that role directly, so
    // HR still can't mint a title that grants Admin, even indirectly through this endpoint.
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
        var titles = await _db.JobTitles.OrderBy(j => j.Name).ToListAsync();
        return Ok(titles.Select(j => new JobTitleDto(j.Id, j.Name, j.SystemRole)).ToList());
    }

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
        if (!RoleTemplates.AssignableRolesByCreatorRole[creatorRole].Contains(request.SystemRole))
        {
            return Forbid();
        }

        var exists = await _db.JobTitles.AnyAsync(j => j.Name == name);
        if (exists) return Conflict("A job title with this name already exists.");

        var jobTitle = new JobTitle { Name = name, SystemRole = request.SystemRole };
        _db.JobTitles.Add(jobTitle);

        _db.AuditLogs.Add(new AuditLog
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
    public async Task<IActionResult> Update(Guid id, UpdateJobTitleRequest request)
    {
        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Forbid();
        if (!RoleTemplates.AssignableRolesByCreatorRole[creatorRole].Contains(request.SystemRole))
        {
            return Forbid();
        }

        var jobTitle = await _db.JobTitles.FirstOrDefaultAsync(j => j.Id == id);
        if (jobTitle is null) return NotFound();

        var previousRole = jobTitle.SystemRole;
        jobTitle.SystemRole = request.SystemRole;

        if (previousRole != request.SystemRole)
        {
            _db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = CurrentUserId,
                Action = "job_title.role_remap",
                EntityType = "JobTitle",
                EntityId = jobTitle.Id,
                Metadata = $"{{\"name\":\"{jobTitle.Name}\",\"from\":\"{previousRole}\",\"to\":\"{request.SystemRole}\"}}",
            });
        }
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
}

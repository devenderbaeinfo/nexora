using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Shared.Common;
using Nexora.Shared.Tenancy;
using Nexora.Modules.Company.Entities;
using Nexora.Modules.HR.Contracts;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.HR.Services;
using Nexora.Modules.Identity.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

// Creates a login-enabled person (Employee record + AppUser + one role) within the caller's
// own tenant. Who may create whom is fixed by RoleTemplates.AssignableRolesByCreatorRole:
// an Admin can only produce HR/Manager accounts, HR can only produce Employee/Manager accounts —
// enforced here, not just in the UI, since the UI is not a trust boundary.
// TenantId on the new AppUser is left unset — DbContext.StampTenantAndTimestamps fills it
// in from the caller's own tenant automatically (see the AppUser/AppRole handling there).
[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly DbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public UsersController(DbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id")!);

    private async Task<string?> CurrentCreatorRoleAsync()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return null;

        var role = await EffectiveRoleResolver.ResolveAsync(_db, _userManager, user);
        return role is not null && RoleTemplates.AssignableRolesByCreatorRole.ContainsKey(role) ? role : null;
    }

    [HttpGet]
    [RequirePermission(Permission.Admin.ManageUsers)]
    public async Task<ActionResult<List<UserSummaryDto>>> List()
    {
        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Ok(new List<UserSummaryDto>());

        // Only ever list the roles this caller is also allowed to manage — HR sees
        // Employee/Manager accounts to reset, not Admin's. Role here is each person's
        // *current* Job Title mapping, not a stored snapshot — always in sync, even
        // right after someone remaps a Job Title, with no separate refresh step.
        var visibleRoles = (await AssignableRoleResolver.ResolveAsync(_db, TenantId, creatorRole)).ToHashSet();

        var employees = await _db.Set<Employee>().ToListAsync();
        var jobTitleRoles = await _db.Set<JobTitle>().ToDictionaryAsync(j => j.Id, j => j.SystemRole);
        var employeeIds = employees.Select(e => e.Id).ToList();

        // Deactivated accounts have nothing left to manage here (no password to reset, no
        // further "delete" to apply) — they belong in People's history, not this list.
        var users = await _db.Set<AppUser>().Where(u => u.IsActive && u.EmployeeId != null && employeeIds.Contains(u.EmployeeId!.Value)).ToListAsync();

        var result = new List<UserSummaryDto>();
        foreach (var u in users)
        {
            var employee = employees.First(e => e.Id == u.EmployeeId);
            if (!jobTitleRoles.TryGetValue(employee.JobTitleId, out var role) || !visibleRoles.Contains(role)) continue;

            result.Add(new UserSummaryDto(
                u.Id, employee.Id, employee.EmployeeCode, $"{employee.FirstName} {employee.LastName}", u.Email ?? "", role,
                u.IsActive && u.CreatedByUserId == CurrentUserId));
        }

        return Ok(result);
    }

    [HttpPost("{userId:guid}/reset-password")]
    [RequirePermission(Permission.Admin.ManageUsers)]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("sensitive-action")]
    public async Task<IActionResult> ResetPassword(Guid userId, ResetPasswordRequest request)
    {
        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Forbid();

        var targetUser = await _db.Set<AppUser>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == TenantId);
        if (targetUser is null) return NotFound();

        var targetRole = await EffectiveRoleResolver.ResolveAsync(_db, _userManager, targetUser);
        var allowedRoles = await AssignableRoleResolver.ResolveAsync(_db, TenantId, creatorRole);
        if (targetRole is null || !allowedRoles.Contains(targetRole))
        {
            // Same boundary as creation: HR can't reset an Admin's password, an Admin can't reset another Admin's.
            return Forbid();
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(targetUser);
        var result = await _userManager.ResetPasswordAsync(targetUser, token, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        // The temp password only ever gets them as far as setting a real one.
        targetUser.MustChangePassword = true;
        targetUser.PasswordChangedAtUtc = DateTimeOffset.UtcNow;
        await _userManager.UpdateAsync(targetUser);

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!),
            Action = "auth.password_reset_by_admin",
            EntityType = "AppUser",
            EntityId = targetUser.Id,
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("assignable-roles")]
    [RequirePermission(Permission.Admin.ManageUsers)]
    public async Task<ActionResult<string[]>> AssignableRoles()
    {
        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Ok(Array.Empty<string>());
        return Ok(await AssignableRoleResolver.ResolveAsync(_db, TenantId, creatorRole));
    }

    [HttpPost]
    [RequirePermission(Permission.Admin.ManageUsers)]
    public async Task<ActionResult<UserSummaryDto>> Create(CreateUserRequest request)
    {
        var creatorRole = await CurrentCreatorRoleAsync();
        if (creatorRole is null) return Forbid();

        var departmentExists = await _db.Set<Department>().AnyAsync(d => d.Id == request.DepartmentId);
        if (!departmentExists) return BadRequest("Unknown department.");

        var jobTitle = await _db.Set<JobTitle>().FirstOrDefaultAsync(j => j.Id == request.JobTitleId);
        if (jobTitle is null) return BadRequest("Unknown job title.");

        // The role this person gets follows entirely from their Job Title now — no separate
        // Role pick — but the "who can create whom" boundary still applies: HR still can't
        // stand up an Admin account just by picking a job title that happens to map to one.
        var allowedRoles = await AssignableRoleResolver.ResolveAsync(_db, TenantId, creatorRole);
        if (!allowedRoles.Contains(jobTitle.SystemRole))
        {
            return Forbid();
        }

        var emailInUse = await _db.Set<Employee>().AnyAsync(e => e.WorkEmail == request.WorkEmail);
        if (emailInUse) return Conflict("An employee with this work email already exists.");

        if (request.ReportingManagerId is null && !request.AcknowledgeNoManager)
        {
            return BadRequest("Pick a reporting manager, or confirm this person has none (top of the org chart).");
        }
        if (request.ReportingManagerId is { } newManagerId)
        {
            var managerExists = await _db.Set<Employee>().AnyAsync(e => e.Id == newManagerId);
            if (!managerExists) return BadRequest("Unknown manager.");
        }

        var employeeCode = await EmployeeCodeGenerator.NextAsync(_db, TenantId);
        var employee = new Employee
        {
            EmployeeCode = employeeCode,
            FirstName = request.FirstName,
            LastName = request.LastName,
            WorkEmail = request.WorkEmail,
            JobTitleId = request.JobTitleId,
            DepartmentId = request.DepartmentId,
            ReportingManagerId = request.ReportingManagerId,
            HireDate = request.HireDate,
        };
        _db.Set<Employee>().Add(employee);
        employee.AddDomainEvent(new EmployeeCreatedEvent(employee.Id, $"{employee.FirstName} {employee.LastName}"));
        _db.Set<EmployeeAssignmentHistory>().Add(new EmployeeAssignmentHistory
        {
            EmployeeId = employee.Id,
            DepartmentId = employee.DepartmentId,
            JobTitleId = employee.JobTitleId,
            ReportingManagerId = employee.ReportingManagerId,
            EffectiveFrom = request.HireDate,
            ChangeReason = $"Created by {creatorRole}",
        });

        // Without this, a newly created person has zero leave balance rows and every leave
        // request they submit gets rejected as "insufficient balance". HR picks exactly which
        // leave types this hire gets and how many days of each (LeaveAllotments); if they don't
        // specify anything, fall back to every leave type at its configured default.
        var leaveTypes = await _db.Set<LeaveType>().ToListAsync();
        var allotments = request.LeaveAllotments is { Count: > 0 }
            ? request.LeaveAllotments.Where(a => leaveTypes.Any(t => t.Id == a.LeaveTypeId)).ToList()
            : leaveTypes.Select(t => new LeaveAllotmentInput(t.Id, t.AnnualAllowance)).ToList();

        foreach (var allotment in allotments)
        {
            _db.Set<LeaveBalance>().Add(new LeaveBalance
            {
                EmployeeId = employee.Id,
                LeaveTypeId = allotment.LeaveTypeId,
                Year = DateTime.UtcNow.Year,
                Allotted = allotment.Allotted,
            });
        }

        await _db.SaveChangesAsync();

        var appUser = new AppUser
        {
            UserName = request.WorkEmail,
            Email = request.WorkEmail,
            EmailConfirmed = true,
            EmployeeId = employee.Id,
            CreatedByUserId = CurrentUserId,
            // The password just typed into this form is a temporary one HR/Admin chose on the
            // new hire's behalf, not something the hire picked themselves — same as an
            // Admin-triggered reset (see ResetPassword below), this forces a real password of
            // their own on first login rather than leaving them on one someone else knows.
            MustChangePassword = true,
        };
        var createResult = await _userManager.CreateAsync(appUser, request.Password);
        if (!createResult.Succeeded)
        {
            return BadRequest(string.Join(" ", createResult.Errors.Select(e => e.Description)));
        }
        await TenantRoleStore.AssignRoleAsync(_db, appUser.TenantId, appUser.Id, jobTitle.SystemRole);

        return CreatedAtAction(nameof(Create), new UserSummaryDto(
            appUser.Id, employee.Id, employee.EmployeeCode, $"{employee.FirstName} {employee.LastName}", employee.WorkEmail, jobTitle.SystemRole, true));
    }

    // "Delete" here means deactivate, not a hard row delete — the account's history
    // (AuditLog.ActorUserId, WorkflowDecision, EmployeeAssignmentHistory) has to stay
    // intact, and IsActive=false already blocks login exactly like a deleted account would.
    // Scoped to accounts the caller themselves created, not everyone their role can see.
    [HttpDelete("{userId:guid}")]
    [RequirePermission(Permission.Admin.ManageUsers)]
    public async Task<IActionResult> Deactivate(Guid userId)
    {
        var targetUser = await _db.Set<AppUser>().IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == TenantId);
        if (targetUser is null) return NotFound();

        if (targetUser.CreatedByUserId != CurrentUserId)
        {
            return Forbid();
        }

        if (!targetUser.IsActive) return NoContent();

        targetUser.IsActive = false;
        await _userManager.UpdateAsync(targetUser);

        // The employee record itself has to reflect this too — otherwise People still lists
        // them as Active even though their account can no longer sign in.
        if (targetUser.EmployeeId is { } employeeId)
        {
            var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == employeeId);
            if (employee is not null)
            {
                employee.Status = EmploymentStatus.Terminated;
                employee.TerminationDate ??= DateOnly.FromDateTime(DateTime.UtcNow);
            }
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "admin.deactivate_user",
            EntityType = "AppUser",
            EntityId = targetUser.Id,
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

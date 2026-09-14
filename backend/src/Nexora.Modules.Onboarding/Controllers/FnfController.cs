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
[Route("api/fnf")]
public class FnfController : ControllerBase
{
    private readonly DbContext _db;
    public FnfController(DbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private bool CanManage => User.HasClaim("perm", Permission.Fnf.Manage);

    [HttpGet]
    [RequirePermission(Permission.Fnf.Manage)]
    public async Task<ActionResult<List<FnfCaseDto>>> All()
    {
        return Ok(await BuildDtos(_db.Set<FnfCase>().Where(c => c.Status != FnfCaseStatus.Completed)));
    }

    [HttpGet("employees/{employeeId:guid}")]
    [RequirePermission(Permission.Fnf.View)]
    public async Task<ActionResult<List<FnfCaseDto>>> ForEmployee(Guid employeeId)
    {
        if (!CanManage && employeeId != CurrentEmployeeId) return Forbid();
        return Ok(await BuildDtos(_db.Set<FnfCase>().Where(c => c.EmployeeId == employeeId)));
    }

    [HttpGet("mine")]
    [RequirePermission(Permission.Fnf.View)]
    public async Task<ActionResult<List<FnfCaseDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<FnfCaseDto>());
        return Ok(await BuildDtos(_db.Set<FnfCase>().Where(c => c.EmployeeId == employeeId)));
    }

    [HttpPost("start")]
    [RequirePermission(Permission.Fnf.Manage)]
    public async Task<IActionResult> Start(StartFnfCaseRequest request)
    {
        var employeeExists = await _db.Set<Employee>().AnyAsync(e => e.Id == request.EmployeeId);
        if (!employeeExists) return BadRequest("Unknown employee.");

        var alreadyOpen = await _db.Set<FnfCase>().AnyAsync(c => c.EmployeeId == request.EmployeeId && c.Status == FnfCaseStatus.InProgress);
        if (alreadyOpen) return Conflict("This employee already has an open settlement case.");

        var fnfCase = new FnfCase { EmployeeId = request.EmployeeId };
        _db.Set<FnfCase>().Add(fnfCase);
        await _db.SaveChangesAsync();

        foreach (var (title, department) in FnfDefaultTemplate.Items)
        {
            _db.Set<FnfClearanceItem>().Add(new FnfClearanceItem
            {
                FnfCaseId = fnfCase.Id,
                EmployeeId = request.EmployeeId,
                Title = title,
                Department = department,
            });
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "fnf.start",
            EntityType = "Employee",
            EntityId = request.EmployeeId,
        });

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ForEmployee), new { employeeId = request.EmployeeId }, null);
    }

    [HttpPatch("items/{id:guid}")]
    [RequirePermission(Permission.Fnf.Manage)]
    public async Task<IActionResult> UpdateItem(Guid id, UpdateFnfItemRequest request)
    {
        var item = await _db.Set<FnfClearanceItem>().FirstOrDefaultAsync(i => i.Id == id);
        if (item is null) return NotFound();

        item.Status = request.Cleared ? FnfClearanceStatus.Cleared : FnfClearanceStatus.Pending;
        item.ClearedAtUtc = request.Cleared ? DateTimeOffset.UtcNow : null;
        item.Notes = request.Notes;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // The final gate: every clearance item must already be Cleared before a case can close,
    // so the payout figure can never be recorded while IT/Finance/Manager sign-off is still pending.
    [HttpPost("{id:guid}/close")]
    [RequirePermission(Permission.Fnf.Manage)]
    public async Task<IActionResult> Close(Guid id, CloseFnfCaseRequest request)
    {
        var fnfCase = await _db.Set<FnfCase>().FirstOrDefaultAsync(c => c.Id == id);
        if (fnfCase is null) return NotFound();
        if (fnfCase.Status == FnfCaseStatus.Completed) return Conflict("This case is already closed.");

        var items = await _db.Set<FnfClearanceItem>().Where(i => i.FnfCaseId == id).ToListAsync();
        if (items.Any(i => i.Status != FnfClearanceStatus.Cleared))
            return Conflict("All clearance items must be cleared before closing.");

        fnfCase.Status = FnfCaseStatus.Completed;
        fnfCase.FinalPayoutAmount = request.FinalPayoutAmount;
        fnfCase.ClosedAtUtc = DateTimeOffset.UtcNow;

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "fnf.close",
            EntityType = "FnfCase",
            EntityId = fnfCase.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<List<FnfCaseDto>> BuildDtos(IQueryable<FnfCase> query)
    {
        var cases = await query.OrderByDescending(c => c.CreatedAtUtc).ToListAsync();
        var caseIds = cases.Select(c => c.Id).ToList();
        var items = await _db.Set<FnfClearanceItem>().Where(i => caseIds.Contains(i.FnfCaseId)).ToListAsync();
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return cases.Select(c => new FnfCaseDto(
            c.Id, c.EmployeeId, employees.TryGetValue(c.EmployeeId, out var name) ? name : "—",
            c.Status.ToString(), c.FinalPayoutAmount, c.ClosedAtUtc,
            items.Where(i => i.FnfCaseId == c.Id)
                .Select(i => new FnfClearanceItemDto(i.Id, i.FnfCaseId, i.Department.ToString(), i.Title, i.Status.ToString(), i.ClearedAtUtc, i.Notes))
                .ToList())).ToList();
    }
}

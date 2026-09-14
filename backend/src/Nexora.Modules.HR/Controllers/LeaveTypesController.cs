using Nexora.Shared.Authorization;
using Nexora.Modules.HR.Contracts;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

[ApiController]
[Authorize]
[Route("api/leave-types")]
public class LeaveTypesController : ControllerBase
{
    private readonly NexoraDbContext _db;
    public LeaveTypesController(NexoraDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Leave.View)]
    public async Task<ActionResult<List<LeaveTypeDto>>> List()
    {
        var types = await _db.LeaveTypes
            .OrderBy(t => t.Name)
            .Select(t => new LeaveTypeDto(t.Id, t.Name, t.AllowsHalfDay, t.SelfCertificationLimitDays, t.AnnualAllowance, t.IsPaidLeave))
            .ToListAsync();
        return Ok(types);
    }

    // The "default" allowance a leave type carries — used to pre-fill new-hire allotments,
    // not a cap. HR can still give any individual employee more or less via LeaveAllotments.
    [HttpPost]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<ActionResult<LeaveTypeDto>> Create(CreateLeaveTypeRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");
        if (name.Length > 200) return BadRequest("Name can't be longer than 200 characters.");
        if (request.AnnualAllowance is < 0 or > 365) return BadRequest("Annual allowance must be between 0 and 365 days.");

        var exists = await _db.LeaveTypes.AnyAsync(t => t.Name == name);
        if (exists) return Conflict("A leave type with this name already exists.");

        var leaveType = new LeaveType
        {
            Name = name,
            AnnualAllowance = request.AnnualAllowance,
            AllowsHalfDay = request.AllowsHalfDay,
            SelfCertificationLimitDays = request.SelfCertificationLimitDays,
            IsPaidLeave = request.IsPaidLeave,
        };
        _db.LeaveTypes.Add(leaveType);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new LeaveTypeDto(leaveType.Id, leaveType.Name, leaveType.AllowsHalfDay, leaveType.SelfCertificationLimitDays, leaveType.AnnualAllowance, leaveType.IsPaidLeave));
    }

    [HttpPatch("{id:guid}")]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<IActionResult> Update(Guid id, UpdateLeaveTypeRequest request)
    {
        var leaveType = await _db.LeaveTypes.FirstOrDefaultAsync(t => t.Id == id);
        if (leaveType is null) return NotFound();

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");
        if (name.Length > 200) return BadRequest("Name can't be longer than 200 characters.");
        if (request.AnnualAllowance is < 0 or > 365) return BadRequest("Annual allowance must be between 0 and 365 days.");

        leaveType.Name = name;
        leaveType.AnnualAllowance = request.AnnualAllowance;
        leaveType.AllowsHalfDay = request.AllowsHalfDay;
        leaveType.SelfCertificationLimitDays = request.SelfCertificationLimitDays;
        leaveType.IsPaidLeave = request.IsPaidLeave;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

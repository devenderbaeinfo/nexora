using Erp.Api.Authorization;
using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

public record AuditLogRowDto(Guid Id, DateTimeOffset CreatedAtUtc, string? ActorName, string Action, string EntityType, Guid? EntityId, string? Metadata, bool WasDenied);

// Read-only surface over the AuditLog table every other controller already writes to
// (approvals, denied access attempts, password resets, user deactivation, job-title role
// remaps). Nothing new is tracked here — this just makes what's already recorded visible,
// so a change that used to only be checkable by querying SQL directly is checkable in the app.
[ApiController]
[Authorize]
[Route("api/audit-log")]
public class AuditLogController : ControllerBase
{
    private readonly ErpDbContext _db;
    public AuditLogController(ErpDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Admin.ViewAuditLog)]
    public async Task<ActionResult<List<AuditLogRowDto>>> List([FromQuery] string? action, [FromQuery] int take = 100)
    {
        var query = _db.AuditLogs.OrderByDescending(a => a.CreatedAtUtc).AsQueryable();
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action.Contains(action));

        var rows = await query.Take(Math.Clamp(take, 1, 500)).ToListAsync();

        var actorIds = rows.Where(r => r.ActorUserId is not null).Select(r => r.ActorUserId!.Value).Distinct().ToList();
        var users = await _db.Users.Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Id);
        var employeeIdByUserId = await _db.Users.Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.EmployeeId);
        var employeeNames = await _db.Employees
            .Where(e => employeeIdByUserId.Values.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        string? ActorName(Guid? actorUserId)
        {
            if (actorUserId is not { } id || !users.ContainsKey(id)) return actorUserId?.ToString();
            var empId = employeeIdByUserId.GetValueOrDefault(id);
            return empId is { } eid && employeeNames.TryGetValue(eid, out var name) ? name : "System";
        }

        return Ok(rows.Select(r => new AuditLogRowDto(r.Id, r.CreatedAtUtc, ActorName(r.ActorUserId), r.Action, r.EntityType, r.EntityId, r.Metadata, r.WasDenied)).ToList());
    }
}

using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Platform.Contracts;
using Nexora.Shared.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Platform.Controllers;

// Manages the subscription tiers a SuperAdmin can assign to a tenant at creation or later
// (see PlatformController). Reachable only by SuperAdmins, same as PlatformController.
[ApiController]
[Authorize]
[Route("api/platform")]
public class PlanController : ControllerBase
{
    private readonly DbContext _db;

    public PlanController(DbContext db)
    {
        _db = db;
    }

    [HttpGet("modules")]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public ActionResult<List<ModuleDto>> ListModules()
    {
        return Ok(ModuleCatalog.AllKeys.Select(k => new ModuleDto(k, ModuleCatalog.Labels[k])).ToList());
    }

    [HttpGet("plans")]
    [RequirePermission(Permission.Platform.ManagePlans)]
    public async Task<ActionResult<List<PlanDto>>> List()
    {
        var plans = await _db.Set<Plan>().Where(p => !p.IsDeleted).OrderBy(p => p.MonthlyPrice).ToListAsync();
        var moduleKeysByPlan = await _db.Set<PlanModule>()
            .GroupBy(pm => pm.PlanId)
            .Select(g => new { PlanId = g.Key, Keys = g.Select(x => x.ModuleKey).ToArray() })
            .ToListAsync();
        var subscriberCounts = await _db.Set<Tenant>()
            .IgnoreQueryFilters()
            .Where(t => t.PlanId != null)
            .GroupBy(t => t.PlanId)
            .Select(g => new { PlanId = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(plans.Select(p => new PlanDto(
            p.Id, p.Name, p.MonthlyPrice, p.IsCustomPricing, p.MaxUsers, p.Status.ToString(),
            moduleKeysByPlan.FirstOrDefault(m => m.PlanId == p.Id)?.Keys ?? [],
            subscriberCounts.FirstOrDefault(s => s.PlanId == p.Id)?.Count ?? 0
        )).ToList());
    }

    [HttpPost("plans")]
    [RequirePermission(Permission.Platform.ManagePlans)]
    public async Task<ActionResult<PlanDto>> Create(CreatePlanRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Plan name is required.");

        var moduleKeys = (request.ModuleKeys ?? []).Where(ModuleCatalog.IsValid).Distinct().ToArray();

        var plan = new Plan
        {
            Name = name,
            MonthlyPrice = request.IsCustomPricing ? null : request.MonthlyPrice,
            IsCustomPricing = request.IsCustomPricing,
            MaxUsers = request.MaxUsers,
        };
        _db.Set<Plan>().Add(plan);
        foreach (var key in moduleKeys)
        {
            _db.Set<PlanModule>().Add(new PlanModule { PlanId = plan.Id, ModuleKey = key });
        }
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new PlanDto(plan.Id, plan.Name, plan.MonthlyPrice, plan.IsCustomPricing, plan.MaxUsers, plan.Status.ToString(), moduleKeys, 0));
    }

    [HttpPut("plans/{id:guid}")]
    [RequirePermission(Permission.Platform.ManagePlans)]
    public async Task<IActionResult> Update(Guid id, UpdatePlanRequest request)
    {
        var plan = await _db.Set<Plan>().FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (plan is null) return NotFound();

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Plan name is required.");

        plan.Name = name;
        plan.IsCustomPricing = request.IsCustomPricing;
        plan.MonthlyPrice = request.IsCustomPricing ? null : request.MonthlyPrice;
        plan.MaxUsers = request.MaxUsers;
        plan.Status = request.Status;
        plan.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var existingModules = await _db.Set<PlanModule>().Where(pm => pm.PlanId == id).ToListAsync();
        _db.Set<PlanModule>().RemoveRange(existingModules);
        foreach (var key in (request.ModuleKeys ?? []).Where(ModuleCatalog.IsValid).Distinct())
        {
            _db.Set<PlanModule>().Add(new PlanModule { PlanId = id, ModuleKey = key });
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Soft-delete only — tenants may still reference this PlanId, and history (e.g. past
    // billing) shouldn't disappear. A deleted plan simply stops being offered to new/edited tenants.
    [HttpDelete("plans/{id:guid}")]
    [RequirePermission(Permission.Platform.ManagePlans)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var plan = await _db.Set<Plan>().FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (plan is null) return NotFound();

        plan.IsDeleted = true;
        plan.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

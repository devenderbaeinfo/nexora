using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Shared.Common;
using Nexora.Modules.HR.Contracts;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Workflow.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

// Admin-configurable "who approves this employee's leave" CRUD — mirrors ReportAccessController's
// shape (a flat list endpoint driving a table + a create/update/delete set), but for
// ApprovalChainDefinition/ApprovalChainStage instead of ReportAccessGrant. Gated by
// Permission.Leave.ConfigurePolicy, the same permission ManageLeaveBalances/leave-types
// configuration already uses, since this is leave-policy configuration too.
[ApiController]
[Authorize]
[Route("api/approval-chains")]
public class ApprovalChainController : ControllerBase
{
    private readonly DbContext _db;
    public ApprovalChainController(DbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<ActionResult<List<ApprovalChainDefinitionDto>>> List()
    {
        var definitions = await _db.Set<ApprovalChainDefinition>()
            .Where(c => c.EntityType == WorkflowDefinitions.LeaveRequest)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync();

        var stages = await _db.Set<ApprovalChainStage>()
            .Where(s => definitions.Select(d => d.Id).Contains(s.ChainDefinitionId))
            .OrderBy(s => s.StageOrder)
            .ToListAsync();

        var roleIds = definitions.Where(d => d.ScopeType == ApprovalChainScopeType.Role && d.ScopeKey is not null)
            .Select(d => d.ScopeKey!.Value)
            .Concat(stages.Where(s => s.ApproverRoleId is not null).Select(s => s.ApproverRoleId!.Value))
            .Distinct().ToList();
        var roleNames = await _db.Set<AppRole>().IgnoreQueryFilters()
            .Where(r => roleIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r.Name!);

        var jobTitleIds = definitions.Where(d => d.ScopeType == ApprovalChainScopeType.JobTitle && d.ScopeKey is not null)
            .Select(d => d.ScopeKey!.Value).Distinct().ToList();
        var jobTitleNames = await _db.Set<JobTitle>()
            .Where(j => jobTitleIds.Contains(j.Id)).ToDictionaryAsync(j => j.Id, j => j.Name);

        var employeeIds = stages.Where(s => s.ApproverEmployeeId is not null).Select(s => s.ApproverEmployeeId!.Value).Distinct().ToList();
        var employeeNames = await _db.Set<Employee>()
            .Where(e => employeeIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        string? ScopeName(ApprovalChainDefinition d) => d.ScopeType switch
        {
            ApprovalChainScopeType.Role => d.ScopeKey is { } r ? roleNames.GetValueOrDefault(r) : null,
            ApprovalChainScopeType.JobTitle => d.ScopeKey is { } j ? jobTitleNames.GetValueOrDefault(j) : null,
            _ => null,
        };

        var stagesByChain = stages.GroupBy(s => s.ChainDefinitionId).ToDictionary(g => g.Key, g => g.ToList());

        return Ok(definitions.Select(d => new ApprovalChainDefinitionDto(
            d.Id, d.EntityType, d.ScopeType, d.ScopeKey, ScopeName(d), d.IsActive,
            stagesByChain.GetValueOrDefault(d.Id, []).Select(s => new ApprovalChainStageDto(
                s.Id, s.StageOrder, s.StageName, s.IsHrStage, s.ResolutionType,
                s.ApproverEmployeeId, s.ApproverEmployeeId is { } eid ? employeeNames.GetValueOrDefault(eid) : null,
                s.ApproverRoleId, s.ApproverRoleId is { } rid ? roleNames.GetValueOrDefault(rid) : null)).ToList()
        )).ToList());
    }

    private async Task<string?> ValidateStages(List<ApprovalChainStageInput> stages)
    {
        if (stages.Count == 0) return "A chain needs at least one stage.";
        foreach (var stage in stages)
        {
            if (string.IsNullOrWhiteSpace(stage.StageName)) return "Every stage needs a name.";
            if (stage.ResolutionType == Workflow.Entities.ApproverResolutionType.SpecificEmployee)
            {
                if (stage.ApproverEmployeeId is null) return $"Stage '{stage.StageName}' needs a specific employee.";
                if (!await _db.Set<Employee>().AnyAsync(e => e.Id == stage.ApproverEmployeeId)) return "Unknown approver employee.";
            }
            if (stage.ResolutionType == Workflow.Entities.ApproverResolutionType.RoleHolders)
            {
                if (stage.ApproverRoleId is null) return $"Stage '{stage.StageName}' needs a role.";
                if (!await _db.Set<AppRole>().IgnoreQueryFilters().AnyAsync(r => r.Id == stage.ApproverRoleId)) return "Unknown approver role.";
            }
        }
        return null;
    }

    [HttpPost]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<IActionResult> Create(CreateApprovalChainDefinitionRequest request)
    {
        if (request.ScopeType != ApprovalChainScopeType.Global && request.ScopeKey is null)
            return BadRequest("A Role or JobTitle scope needs a ScopeKey.");
        if (request.ScopeType == ApprovalChainScopeType.Global) { /* ScopeKey ignored */ }

        if (request.ScopeType == ApprovalChainScopeType.Role
            && !await _db.Set<AppRole>().IgnoreQueryFilters().AnyAsync(r => r.Id == request.ScopeKey))
            return BadRequest("Unknown role.");
        if (request.ScopeType == ApprovalChainScopeType.JobTitle
            && !await _db.Set<JobTitle>().AnyAsync(j => j.Id == request.ScopeKey))
            return BadRequest("Unknown job title.");

        // Only one active definition per (EntityType, ScopeType, ScopeKey) makes sense — a
        // second one for the same scope would just create an ambiguous tie in ResolveChainAsync.
        var duplicate = await _db.Set<ApprovalChainDefinition>().AnyAsync(c =>
            c.EntityType == WorkflowDefinitions.LeaveRequest && c.IsActive
            && c.ScopeType == request.ScopeType && c.ScopeKey == request.ScopeKey);
        if (duplicate) return Conflict("An active chain already exists for this scope — deactivate or edit it instead.");

        if (await ValidateStages(request.Stages) is { } error) return BadRequest(error);

        var definition = new ApprovalChainDefinition
        {
            EntityType = WorkflowDefinitions.LeaveRequest,
            ScopeType = request.ScopeType,
            ScopeKey = request.ScopeType == ApprovalChainScopeType.Global ? null : request.ScopeKey,
            IsActive = true,
        };
        _db.Set<ApprovalChainDefinition>().Add(definition);
        await _db.SaveChangesAsync();

        for (var i = 0; i < request.Stages.Count; i++)
        {
            var s = request.Stages[i];
            _db.Set<ApprovalChainStage>().Add(new ApprovalChainStage
            {
                ChainDefinitionId = definition.Id,
                StageOrder = i,
                StageName = s.StageName,
                IsHrStage = s.IsHrStage,
                ResolutionType = s.ResolutionType,
                ApproverEmployeeId = s.ApproverEmployeeId,
                ApproverRoleId = s.ApproverRoleId,
            });
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "approval_chain.create",
            EntityType = "ApprovalChainDefinition",
            EntityId = definition.Id,
            Metadata = $"{{\"scopeType\":\"{request.ScopeType}\",\"stages\":{request.Stages.Count}}}",
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new { id = definition.Id });
    }

    // Replaces the full stage list (reorder/add/remove all handled by "send the new list") and
    // optionally flips IsActive. Existing in-flight LeaveRequests are unaffected — they already
    // snapshotted their chain's stage names at submission time (LeaveRequest.ApprovalChainDefinitionId
    // plus WorkflowInstance.StagesCsv), so editing a definition only ever changes future requests.
    [HttpPut("{id:guid}")]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<IActionResult> Update(Guid id, UpdateApprovalChainDefinitionRequest request)
    {
        var definition = await _db.Set<ApprovalChainDefinition>().FirstOrDefaultAsync(c => c.Id == id);
        if (definition is null) return NotFound();

        if (await ValidateStages(request.Stages) is { } error) return BadRequest(error);

        var existingStages = await _db.Set<ApprovalChainStage>().Where(s => s.ChainDefinitionId == id).ToListAsync();
        _db.Set<ApprovalChainStage>().RemoveRange(existingStages);

        for (var i = 0; i < request.Stages.Count; i++)
        {
            var s = request.Stages[i];
            _db.Set<ApprovalChainStage>().Add(new ApprovalChainStage
            {
                ChainDefinitionId = id,
                StageOrder = i,
                StageName = s.StageName,
                IsHrStage = s.IsHrStage,
                ResolutionType = s.ResolutionType,
                ApproverEmployeeId = s.ApproverEmployeeId,
                ApproverRoleId = s.ApproverRoleId,
            });
        }

        definition.IsActive = request.IsActive;

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "approval_chain.update",
            EntityType = "ApprovalChainDefinition",
            EntityId = id,
            Metadata = $"{{\"isActive\":{(request.IsActive ? "true" : "false")},\"stages\":{request.Stages.Count}}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // Deletes the definition entirely — affected employees revert to the next-most-specific
    // active definition (or the hardcoded Manager->HR default if none exists) on their very
    // next leave submission, per IApprovalChainResolver's precedence.
    [HttpDelete("{id:guid}")]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var definition = await _db.Set<ApprovalChainDefinition>().FirstOrDefaultAsync(c => c.Id == id);
        if (definition is null) return NotFound();

        var stages = await _db.Set<ApprovalChainStage>().Where(s => s.ChainDefinitionId == id).ToListAsync();
        _db.Set<ApprovalChainStage>().RemoveRange(stages);
        _db.Set<ApprovalChainDefinition>().Remove(definition);

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "approval_chain.delete",
            EntityType = "ApprovalChainDefinition",
            EntityId = id,
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

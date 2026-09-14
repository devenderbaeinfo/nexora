using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Contracts;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Identity.Controllers;

// Tenant-scoped RBAC management: every company's own Admin decides what HR/Manager/Finance/
// Employee (and any custom role they create) can actually do here — the six system roles ship
// with a sensible default permission set (RoleTemplates), but nothing about it is fixed once a
// tenant exists. IsCustomized marks a role an Admin has touched, so RolePermissionSync (which
// tops up newly shipped permissions on untouched roles) never overwrites a deliberate choice.
[ApiController]
[Authorize]
[Route("api/roles")]
public class RolesController : ControllerBase
{
    private readonly NexoraDbContext _db;
    public RolesController(NexoraDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id")!);

    private static readonly HashSet<string> ValidPermissionKeys = Permission.Catalog().Select(p => p.Key).ToHashSet();

    [HttpGet("permissions")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public ActionResult<List<PermissionCatalogItemDto>> Permissions() =>
        Ok(Permission.Catalog().Select(p => new PermissionCatalogItemDto(p.Module, p.Key)).ToList());

    [HttpGet]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<ActionResult<List<RoleDto>>> List()
    {
        var roles = await _db.Roles.IgnoreQueryFilters().Where(r => r.TenantId == TenantId)
            .OrderByDescending(r => r.IsSystemRole).ThenBy(r => r.Name).ToListAsync();
        var permissionsByRole = await _db.RolePermissions
            .GroupBy(rp => rp.RoleId)
            .Select(g => new { RoleId = g.Key, Keys = g.Select(rp => rp.PermissionKey).ToList() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Keys);
        var jobTitleCounts = await _db.JobTitles
            .GroupBy(j => j.SystemRole)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Role, x => x.Count);

        return Ok(roles.Select(r => new RoleDto(
            r.Id, r.Name!, r.IsSystemRole, r.IsCustomized,
            permissionsByRole.GetValueOrDefault(r.Id, []),
            jobTitleCounts.GetValueOrDefault(r.Name!, 0))).ToList());
    }

    // A brand-new role starts with exactly the permissions the Admin picks — no implicit
    // default set, since there's no template for something that didn't exist before.
    [HttpPost]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> Create(CreateRoleRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Name is required.");
        if (name.Length > 100) return BadRequest("Name can't be longer than 100 characters.");

        var normalized = name.ToUpperInvariant();
        var exists = await _db.Roles.IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == TenantId && r.NormalizedName == normalized);
        if (exists) return Conflict("A role with this name already exists.");

        var invalid = request.Permissions.Where(p => !ValidPermissionKeys.Contains(p)).ToList();
        if (invalid.Count > 0) return BadRequest($"Unknown permission key(s): {string.Join(", ", invalid)}.");

        var role = new AppRole { TenantId = TenantId, Name = name, NormalizedName = normalized, IsSystemRole = false, IsCustomized = true };
        _db.Roles.Add(role);
        foreach (var key in request.Permissions.Distinct())
        {
            _db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionKey = key });
        }

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "role.create",
            EntityType = "AppRole",
            EntityId = role.Id,
            Metadata = $"{{\"name\":\"{name}\"}}",
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new RoleDto(role.Id, role.Name!, false, true, request.Permissions, 0));
    }

    [HttpPatch("{id:guid}/permissions")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> UpdatePermissions(Guid id, UpdateRolePermissionsRequest request)
    {
        var role = await _db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == id && r.TenantId == TenantId);
        if (role is null) return NotFound();

        var invalid = request.Permissions.Where(p => !ValidPermissionKeys.Contains(p)).ToList();
        if (invalid.Count > 0) return BadRequest($"Unknown permission key(s): {string.Join(", ", invalid)}.");

        var existing = await _db.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync();
        _db.RolePermissions.RemoveRange(existing);
        foreach (var key in request.Permissions.Distinct())
        {
            _db.RolePermissions.Add(new RolePermission { RoleId = id, PermissionKey = key });
        }

        role.IsCustomized = true;

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "role.update_permissions",
            EntityType = "AppRole",
            EntityId = role.Id,
            Metadata = $"{{\"name\":\"{role.Name}\",\"permissionCount\":{request.Permissions.Count}}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // Only a custom role that nothing currently uses can be deleted — a system role can never
    // be removed (Admin/HR/Manager/Finance/Employee are load-bearing across this codebase),
    // and a custom role still mapped to a Job Title would silently orphan every employee
    // holding it (EffectiveRoleResolver would resolve them to a role that no longer exists).
    [HttpDelete("{id:guid}")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var role = await _db.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == id && r.TenantId == TenantId);
        if (role is null) return NotFound();
        if (role.IsSystemRole) return BadRequest("System roles can't be deleted.");

        var inUseByJobTitle = await _db.JobTitles.AnyAsync(j => j.SystemRole == role.Name);
        if (inUseByJobTitle) return Conflict("This role is still mapped to one or more job titles.");

        var inUseByUser = await _db.UserRoles.AnyAsync(ur => ur.RoleId == id);
        if (inUseByUser) return Conflict("This role is still assigned to one or more users.");

        var permissions = await _db.RolePermissions.Where(rp => rp.RoleId == id).ToListAsync();
        _db.RolePermissions.RemoveRange(permissions);
        _db.Roles.Remove(role);

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "role.delete",
            EntityType = "AppRole",
            EntityId = role.Id,
            Metadata = $"{{\"name\":\"{role.Name}\"}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // Which permission keys can be data-scoped at all, and which scope types make sense for
    // each one ("Mine" is meaningless for a permission with no notion of ownership).
    [HttpGet("scopable-permissions")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public ActionResult<List<ScopablePermissionDto>> ScopablePermissions() =>
        Ok(DataScopeCatalog.ScopablePermissions
            .Select(p => new ScopablePermissionDto(p, DataScopeCatalog.AllowedScopeTypesFor(p).Select(t => t.ToString()).ToArray()))
            .ToList());

    [HttpGet("{id:guid}/scopes")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<ActionResult<List<RoleScopeDto>>> Scopes(Guid id)
    {
        var roleExists = await _db.Roles.IgnoreQueryFilters().AnyAsync(r => r.Id == id && r.TenantId == TenantId);
        if (!roleExists) return NotFound();

        var scopes = await _db.PermissionScopes.Where(s => s.RoleId == id).ToListAsync();
        var result = new List<RoleScopeDto>();
        foreach (var scope in scopes)
        {
            var specificIds = scope.ScopeType == DataScopeType.Specific
                ? await _db.PermissionScopeRecords.Where(r => r.PermissionScopeId == scope.Id).Select(r => r.RecordId).ToListAsync()
                : [];
            result.Add(new RoleScopeDto(scope.PermissionKey, scope.ScopeType.ToString(), specificIds));
        }
        return Ok(result);
    }

    // Upsert: a role starts with no PermissionScope row (meaning "All"); setting one back to
    // "All" here removes the row entirely rather than leaving a redundant All row behind.
    [HttpPut("{id:guid}/scopes/{permissionKey}")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> UpdateScope(Guid id, string permissionKey, UpdateRoleScopeRequest request)
    {
        var roleExists = await _db.Roles.IgnoreQueryFilters().AnyAsync(r => r.Id == id && r.TenantId == TenantId);
        if (!roleExists) return NotFound();
        if (!DataScopeCatalog.ScopablePermissions.Contains(permissionKey)) return BadRequest("This permission can't be data-scoped.");
        if (!Enum.TryParse<DataScopeType>(request.ScopeType, out var scopeType)) return BadRequest("Unknown scope type.");
        if (!DataScopeCatalog.AllowedScopeTypesFor(permissionKey).Contains(scopeType)) return BadRequest("This scope type isn't valid for this permission.");

        var existing = await _db.PermissionScopes.FirstOrDefaultAsync(s => s.RoleId == id && s.PermissionKey == permissionKey);

        if (scopeType == DataScopeType.All)
        {
            if (existing is not null)
            {
                _db.PermissionScopeRecords.RemoveRange(_db.PermissionScopeRecords.Where(r => r.PermissionScopeId == existing.Id));
                _db.PermissionScopes.Remove(existing);
            }
        }
        else
        {
            if (existing is null)
            {
                existing = new PermissionScope { RoleId = id, PermissionKey = permissionKey };
                _db.PermissionScopes.Add(existing);
                await _db.SaveChangesAsync(); // need existing.Id before adding child records below
            }
            existing.ScopeType = scopeType;

            var oldRecords = await _db.PermissionScopeRecords.Where(r => r.PermissionScopeId == existing.Id).ToListAsync();
            _db.PermissionScopeRecords.RemoveRange(oldRecords);
            if (scopeType == DataScopeType.Specific)
            {
                foreach (var recordId in (request.SpecificRecordIds ?? []).Distinct())
                {
                    _db.PermissionScopeRecords.Add(new PermissionScopeRecord { PermissionScopeId = existing.Id, RecordId = recordId });
                }
            }
        }

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "role.update_scope",
            EntityType = "AppRole",
            EntityId = id,
            Metadata = $"{{\"permissionKey\":\"{permissionKey}\",\"scopeType\":\"{scopeType}\"}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("field-catalog")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public ActionResult<List<FieldCatalogItemDto>> FieldCatalog() =>
        Ok(FieldPermissionCatalog.FieldsByResource
            .SelectMany(kv => kv.Value.Select(field => new FieldCatalogItemDto(kv.Key, field)))
            .ToList());

    [HttpGet("{id:guid}/field-permissions")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<ActionResult<List<RoleFieldPermissionDto>>> FieldPermissions(Guid id)
    {
        var roleExists = await _db.Roles.IgnoreQueryFilters().AnyAsync(r => r.Id == id && r.TenantId == TenantId);
        if (!roleExists) return NotFound();

        var fields = await _db.RoleFieldPermissions.Where(f => f.RoleId == id).ToListAsync();
        return Ok(fields.Select(f => new RoleFieldPermissionDto(f.Resource, f.FieldName, f.Access.ToString())).ToList());
    }

    // Bulk-replaces every field permission for one resource on this role — simpler than
    // per-field upserts, and the UI always edits a whole resource's field list at once anyway.
    [HttpPut("{id:guid}/field-permissions")]
    [RequirePermission(Permission.Admin.ManageRoles)]
    public async Task<IActionResult> UpdateFieldPermissions(Guid id, UpdateRoleFieldPermissionsRequest request)
    {
        var roleExists = await _db.Roles.IgnoreQueryFilters().AnyAsync(r => r.Id == id && r.TenantId == TenantId);
        if (!roleExists) return NotFound();
        if (!FieldPermissionCatalog.FieldsByResource.TryGetValue(request.Resource, out var validFields))
            return BadRequest("Unknown resource.");

        var existing = await _db.RoleFieldPermissions.Where(f => f.RoleId == id && f.Resource == request.Resource).ToListAsync();
        _db.RoleFieldPermissions.RemoveRange(existing);

        foreach (var field in request.Fields)
        {
            if (!validFields.Contains(field.FieldName)) return BadRequest($"Unknown field: {field.FieldName}.");
            if (!Enum.TryParse<FieldAccessLevel>(field.Access, out var access)) return BadRequest($"Unknown access level: {field.Access}.");
            _db.RoleFieldPermissions.Add(new RoleFieldPermission { RoleId = id, Resource = request.Resource, FieldName = field.FieldName, Access = access });
        }

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "role.update_field_permissions",
            EntityType = "AppRole",
            EntityId = id,
            Metadata = $"{{\"resource\":\"{request.Resource}\"}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

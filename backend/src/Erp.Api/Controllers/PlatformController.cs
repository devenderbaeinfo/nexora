using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Identity;
using Erp.Domain.People;
using Erp.Domain.Tenancy;
using Erp.Infrastructure.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// Reachable only by accounts in the reserved "platform" tenant holding platform.manage_tenants —
// i.e. only a SuperAdmin. This is the one place in the codebase that deliberately writes rows
// into a tenant other than the caller's own (see ErpDbContext.StampTenantAndTimestamps).
[ApiController]
[Authorize]
[Route("api/platform/tenants")]
public class PlatformController : ControllerBase
{
    private readonly ErpDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public PlatformController(ErpDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<ActionResult<List<TenantSummaryDto>>> List()
    {
        var tenants = await _db.Tenants
            .IgnoreQueryFilters()
            .Where(t => t.Slug != "platform")
            .OrderBy(t => t.Name)
            .Select(t => new TenantSummaryDto(t.Id, t.Name, t.Slug, t.Status.ToString(), t.BaseCurrencyCode, t.CreatedAtUtc))
            .ToListAsync();
        return Ok(tenants);
    }

    [HttpPost]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<IActionResult> Create(CreateTenantRequest request)
    {
        var slug = request.TenantSlug.Trim().ToLowerInvariant();
        if (slug is "platform" or "") return BadRequest("That workspace name isn't available.");

        var slugTaken = await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Slug == slug);
        if (slugTaken) return Conflict("That workspace name is already taken.");

        var baseCurrency = string.IsNullOrWhiteSpace(request.BaseCurrencyCode) ? "INR" : request.BaseCurrencyCode.Trim().ToUpperInvariant();
        var tenant = new Tenant { Name = request.TenantName.Trim(), Slug = slug, BaseCurrencyCode = baseCurrency };
        _db.Tenants.Add(tenant);
        await _db.SaveChangesAsync();

        // Every system role is provisioned up front — Admin is the only one with a login today,
        // but HR/Manager/Employee rows must already exist for UsersController to assign people to them later.
        foreach (var roleName in new[] { RoleTemplates.Admin, RoleTemplates.Hr, RoleTemplates.Manager, RoleTemplates.Finance, RoleTemplates.Employee })
        {
            var role = await TenantRoleStore.EnsureRoleAsync(_db, tenant.Id, roleName);

            foreach (var perm in RoleTemplates.PermissionsFor(roleName))
            {
                _db.RolePermissions.Add(new RolePermission { TenantId = tenant.Id, RoleId = role.Id, PermissionKey = perm });
            }
        }
        await _db.SaveChangesAsync();

        // A starter set of common corporate departments — without this, a new Admin's first
        // "Add person" hits an empty dropdown with no way forward. Still just a starting
        // point: Admin can rename, add, or remove departments freely from there.
        foreach (var deptName in new[] { "Operations", "Human Resources", "Engineering", "Finance", "Sales", "Marketing" })
        {
            _db.Departments.Add(new Department { TenantId = tenant.Id, Name = deptName });
        }
        await _db.SaveChangesAsync();

        // JobTitleSync/AccountSync otherwise only ever run at app startup — a tenant provisioned
        // while the app is already running (i.e. every real one, since this is the only way
        // tenants get created) would sit with no default job titles or Chart of Accounts until
        // the next deploy. Both are additive/idempotent, so running them here is safe even
        // though they re-scan every tenant, not just this new one.
        await Erp.Api.Seed.JobTitleSync.RunAsync(HttpContext.RequestServices);
        await Erp.Api.Seed.AccountSync.RunAsync(HttpContext.RequestServices);
        await Erp.Api.Seed.DefaultDataScopeSync.RunAsync(HttpContext.RequestServices);

        var adminUser = new AppUser
        {
            TenantId = tenant.Id,
            UserName = request.AdminEmail.Trim(),
            Email = request.AdminEmail.Trim(),
            EmailConfirmed = true,
            // A SuperAdmin-chosen temporary password — force the tenant's first Admin to set
            // their own on first login, same as any other new account (UsersController.Create).
            MustChangePassword = true,
        };
        var createResult = await _userManager.CreateAsync(adminUser, request.AdminPassword);
        if (!createResult.Succeeded)
        {
            return BadRequest(string.Join(" ", createResult.Errors.Select(e => e.Description)));
        }
        await TenantRoleStore.AssignRoleAsync(_db, tenant.Id, adminUser.Id, RoleTemplates.Admin);

        return CreatedAtAction(nameof(List), new TenantSummaryDto(tenant.Id, tenant.Name, tenant.Slug, tenant.Status.ToString(), tenant.BaseCurrencyCode, tenant.CreatedAtUtc));
    }

    // Suspending a tenant here is what actually blocks every one of its users at login
    // (AuthController checks tenant.Status == Suspended) — until this existed, Status was a
    // column nothing in the app could ever change after tenant creation.
    [HttpPatch("{id:guid}/status")]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<IActionResult> UpdateStatus(Guid id, UpdateTenantStatusRequest request)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == id);
        if (tenant is null) return NotFound();
        if (tenant.Slug == "platform") return BadRequest("The platform tenant itself can't be suspended.");

        tenant.Status = request.Status;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // SuperAdmin accounts live in the reserved "platform" tenant — everything below is scoped
    // to that one tenant, never a customer's. There's no "who can create a SuperAdmin" boundary
    // beyond already being one: this is the top of the hierarchy, nothing above it to check against.
    [HttpGet("/api/platform/superadmins")]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<ActionResult<List<SuperAdminDto>>> ListSuperAdmins()
    {
        var platformTenant = await _db.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Slug == "platform");
        var role = await _db.Roles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.TenantId == platformTenant.Id && r.NormalizedName == "SUPERADMIN");
        if (role is null) return Ok(new List<SuperAdminDto>());

        var userIds = await _db.UserRoles.Where(ur => ur.RoleId == role.Id).Select(ur => ur.UserId).ToListAsync();
        var users = await _db.Users.IgnoreQueryFilters().Where(u => userIds.Contains(u.Id)).ToListAsync();

        return Ok(users.Select(u => new SuperAdminDto(u.Id, u.Email ?? "", u.IsActive)).ToList());
    }

    [HttpPost("/api/platform/superadmins")]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<ActionResult<SuperAdminDto>> CreateSuperAdmin(CreateSuperAdminRequest request)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email)) return BadRequest("Email is required.");

        var exists = await _userManager.Users.IgnoreQueryFilters().AnyAsync(u => u.NormalizedEmail == email.ToUpperInvariant());
        if (exists) return Conflict("An account with this email already exists.");

        var platformTenant = await _db.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Slug == "platform");
        var newSuperAdmin = new AppUser
        {
            TenantId = platformTenant.Id, UserName = email, Email = email, EmailConfirmed = true,
            MustChangePassword = true,
        };
        var result = await _userManager.CreateAsync(newSuperAdmin, request.Password);
        if (!result.Succeeded) return BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));

        await TenantRoleStore.AssignRoleAsync(_db, platformTenant.Id, newSuperAdmin.Id, RoleTemplates.SuperAdmin);

        return CreatedAtAction(nameof(ListSuperAdmins), new SuperAdminDto(newSuperAdmin.Id, email, true));
    }

    // Deactivate, not delete — same reasoning as a tenant Admin's own users: history has to
    // stay intact. A SuperAdmin can't deactivate themselves, so the platform is never left with zero.
    [HttpDelete("/api/platform/superadmins/{userId:guid}")]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<IActionResult> DeactivateSuperAdmin(Guid userId)
    {
        if (userId == CurrentUserId) return BadRequest("You can't deactivate your own account.");

        var target = await _userManager.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId);
        if (target is null) return NotFound();

        target.IsActive = false;
        await _userManager.UpdateAsync(target);

        return NoContent();
    }
}

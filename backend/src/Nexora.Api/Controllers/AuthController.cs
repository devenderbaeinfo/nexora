using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Nexora.Api.Contracts;
using Nexora.Modules.Identity.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Nexora.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly NexoraDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;

    public AuthController(UserManager<AppUser> userManager, NexoraDbContext db, IConfiguration config, ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _db = db;
        _config = config;
        _logger = logger;
    }

    [HttpPost("login")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("login")]
    [ProducesResponseType(typeof(LoginResponse), 200)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        // Every branch below returns the same generic 401 and the same audit action name.
        // Distinguishing "unknown email" from "wrong password" in the response would let an
        // attacker enumerate valid accounts — so we deliberately don't. Email is globally
        // unique across the platform (see Program.cs's RequireUniqueEmail), so the tenant
        // is read off the matched account instead of asking the caller which workspace to use.
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await _userManager.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail);

        if (user is null || !user.IsActive)
        {
            await AuditLoginFailure(null, request.Email, "user_not_found_or_inactive");
            return Unauthorized();
        }

        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == user.TenantId);
        if (tenant is null || tenant.Status == Nexora.Shared.Tenancy.TenantStatus.Suspended)
        {
            await AuditLoginFailure(user.TenantId, request.Email, "tenant_not_found_or_suspended");
            return Unauthorized();
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            await AuditLoginFailure(tenant.Id, request.Email, "locked_out");
            return Unauthorized();
        }

        var passwordOk = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordOk)
        {
            await _userManager.AccessFailedAsync(user);
            await AuditLoginFailure(tenant.Id, request.Email, "bad_password");
            return Unauthorized();
        }

        await _userManager.ResetAccessFailedCountAsync(user);
        user.LastLoginAtUtc = DateTimeOffset.UtcNow;
        await _userManager.UpdateAsync(user);

        // Resolved fresh on every login from the employee's *current* Job Title — never a
        // role snapshot taken at account-creation time — so a Job Title remap takes effect
        // for everyone holding it automatically, no per-account fix-up required.
        var effectiveRole = await Nexora.Modules.HR.Services.EffectiveRoleResolver.ResolveAsync(_db, _userManager, user);
        var roleIds = effectiveRole is null ? [] : await _db.Set<AppRole>().IgnoreQueryFilters()
            .Where(r => r.TenantId == tenant.Id && r.Name == effectiveRole)
            .Select(r => r.Id).ToListAsync();

        var permissions = await _db.RolePermissions
            .IgnoreQueryFilters()
            .Where(rp => rp.TenantId == tenant.Id && roleIds.Contains(rp.RoleId))
            .Select(rp => rp.PermissionKey)
            .Distinct()
            .ToListAsync();

        // Password rotation: 180 days since it was last set, or an HR/Admin-triggered reset —
        // either way the account can still authenticate, but every other endpoint is locked
        // down (see RequirePasswordCurrentMiddleware) until a new password is set.
        var passwordExpired = DateTimeOffset.UtcNow - user.PasswordChangedAtUtc > TimeSpan.FromDays(180);
        var mustChangePassword = user.MustChangePassword || passwordExpired;

        var (token, expires) = IssueToken(user, tenant.Id, roleIds, permissions, mustChangePassword);

        _db.AuditLogs.Add(new Nexora.Shared.Common.AuditLog
        {
            TenantId = tenant.Id,
            ActorUserId = user.Id,
            Action = "auth.login_succeeded",
            EntityType = "AppUser",
            EntityId = user.Id,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });
        await _db.SaveChangesAsync();

        return Ok(new LoginResponse(token, expires, user.Email ?? user.UserName ?? "", effectiveRole ?? "", permissions.ToArray(), mustChangePassword, tenant.BaseCurrencyCode));
    }

    [HttpPost("change-password")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var user = await _userManager.FindByIdAsync(userId!);
        if (user is null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        user.PasswordChangedAtUtc = DateTimeOffset.UtcNow;
        user.MustChangePassword = false;
        await _userManager.UpdateAsync(user);

        _db.AuditLogs.Add(new Nexora.Shared.Common.AuditLog
        {
            ActorUserId = user.Id,
            Action = "auth.password_changed",
            EntityType = "AppUser",
            EntityId = user.Id,
        });
        await _db.SaveChangesAsync();

        // The old JWT still carries pwd_change_required from before this call — tokens are
        // immutable once signed — so hand back a fresh one without it rather than leaving
        // the client stuck locked-out with a technically-valid-but-stale token.
        var effectiveRole = await Nexora.Modules.HR.Services.EffectiveRoleResolver.ResolveAsync(_db, _userManager, user);
        var roleIds = effectiveRole is null ? [] : await _db.Set<AppRole>().IgnoreQueryFilters()
            .Where(r => r.TenantId == user.TenantId && r.Name == effectiveRole)
            .Select(r => r.Id).ToListAsync();
        var permissions = await _db.RolePermissions
            .IgnoreQueryFilters()
            .Where(rp => rp.TenantId == user.TenantId && roleIds.Contains(rp.RoleId))
            .Select(rp => rp.PermissionKey)
            .Distinct()
            .ToListAsync();

        var (token, expires) = IssueToken(user, user.TenantId, roleIds, permissions, mustChangePassword: false);
        var currentTenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == user.TenantId);
        return Ok(new LoginResponse(token, expires, user.Email ?? user.UserName ?? "", effectiveRole ?? "", permissions.ToArray(), false, currentTenant?.BaseCurrencyCode ?? "INR"));
    }

    private async Task AuditLoginFailure(Guid? tenantId, string attemptedEmail, string reason)
    {
        _logger.LogWarning("Login failed for {Email}: {Reason}", attemptedEmail, reason);
        if (tenantId is null) return; // no tenant resolved — nothing to scope the audit row to

        _db.AuditLogs.Add(new Nexora.Shared.Common.AuditLog
        {
            TenantId = tenantId.Value,
            Action = "auth.login_failed",
            EntityType = "AppUser",
            Metadata = System.Text.Json.JsonSerializer.Serialize(new { attemptedEmail, reason }),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            WasDenied = true
        });
        await _db.SaveChangesAsync();
    }

    private (string token, DateTimeOffset expires) IssueToken(AppUser user, Guid tenantId, List<Guid> roleIds, List<string> permissions, bool mustChangePassword)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new("tenant_id", tenantId.ToString()),
        };
        if (user.EmployeeId is { } employeeId)
        {
            claims.Add(new Claim("employee_id", employeeId.ToString()));
        }
        // Carries which role(s) granted the "perm" claims below, so data-scope/field-level
        // lookups (DataScopeService) can find the right PermissionScope/RoleFieldPermission
        // rows without a DB round trip just to re-derive the caller's role from EmployeeId.
        claims.AddRange(roleIds.Select(id => new Claim("role_id", id.ToString())));
        if (mustChangePassword)
        {
            // Checked by RequirePasswordCurrentMiddleware to lock every endpoint except
            // change-password down until this is resolved — carried in the token itself
            // rather than re-queried per request, so a stale token can't skip the check.
            claims.Add(new Claim("pwd_change_required", "1"));
        }
        claims.AddRange(permissions.Select(p => new Claim("perm", p)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:SigningKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTimeOffset.UtcNow.AddHours(8); // short-lived on purpose; refresh flow lands separately

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expires.UtcDateTime,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}

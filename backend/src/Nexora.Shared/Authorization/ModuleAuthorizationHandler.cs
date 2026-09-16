using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Nexora.Shared.Tenancy;

namespace Nexora.Shared.Authorization;

// Unlike PermissionRequirement, this deliberately hits the DB on every check rather than
// reading a JWT claim: a tenant's plan/module entitlement can change while a user's token is
// still valid, and a SuperAdmin editing a client's plan should take effect immediately rather
// than only after everyone in that tenant logs out and back in.
public class ModuleRequirement : IAuthorizationRequirement
{
    public string ModuleKey { get; }
    public ModuleRequirement(string moduleKey) => ModuleKey = moduleKey;
}

public class ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>
{
    private readonly DbContext _db;
    private readonly ITenantContext _tenant;

    public ModuleAuthorizationHandler(DbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ModuleRequirement requirement)
    {
        if (!_tenant.IsResolved) return;

        var hasModule = await _db.Set<TenantModule>()
            .AnyAsync(tm => tm.TenantId == _tenant.TenantId && tm.ModuleKey == requirement.ModuleKey);
        if (hasModule)
        {
            context.Succeed(requirement);
        }
    }
}

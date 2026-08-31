using Microsoft.AspNetCore.Authorization;

namespace Erp.Api.Authorization;

// Every permission string is registered as its own AuthorizationPolicy (see Program.cs),
// and this single handler checks it against the "perm" claims baked into the caller's JWT
// at login time (see AuthController) — so authorization is a claim lookup, not a DB round trip per request.
public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }
    public PermissionRequirement(string permission) => Permission = permission;
}

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.Claims.Any(c => c.Type == "perm" && c.Value == requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

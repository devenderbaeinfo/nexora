using Microsoft.AspNetCore.Authorization;

namespace Nexora.Shared.Authorization;

// Usage: [RequireModule(ModuleCatalog.Payroll)] on a controller (class-level, so every action
// on it is covered). Combine with [RequirePermission(...)] where both apply — module gates
// "did this tenant buy this feature at all", permission gates "can this specific role use it".
// The "module:" prefix lets PermissionPolicyProvider tell the two kinds of policy apart
// without needing a second IAuthorizationPolicyProvider (ASP.NET only allows one).
public class RequireModuleAttribute : AuthorizeAttribute
{
    public RequireModuleAttribute(string moduleKey) : base(policy: $"module:{moduleKey}") { }
}

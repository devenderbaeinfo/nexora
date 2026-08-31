using Microsoft.AspNetCore.Authorization;

namespace Erp.Api.Authorization;

// Usage: [RequirePermission(Permission.Leave.Approve)] on a controller action.
// Maps 1:1 to a Permission.* constant so "what can call this endpoint" is grep-able,
// and a denied attempt still flows through ASP.NET's normal 403 + audit pipeline.
public class RequirePermissionAttribute : AuthorizeAttribute
{
    public RequirePermissionAttribute(string permission) : base(policy: permission) { }
}

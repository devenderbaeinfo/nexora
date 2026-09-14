using Microsoft.AspNetCore.Http;

namespace Nexora.Shared.Authorization;

// A forced password change is enforced here, not just by the frontend hiding the rest of the
// app — a caller who ignores the UI and hits the API directly with a "must change" token still
// gets locked out of everything except the one endpoint that lets them fix it.
public class RequirePasswordCurrentMiddleware
{
    private readonly RequestDelegate _next;

    public RequirePasswordCurrentMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var mustChange = context.User.Claims.Any(c => c.Type == "pwd_change_required");
        var isAllowedPath = context.Request.Path.StartsWithSegments("/api/auth/change-password")
            || context.Request.Path.StartsWithSegments("/api/auth/login");

        if (mustChange && !isAllowedPath)
        {
            context.Response.StatusCode = StatusCodes.Status423Locked;
            await context.Response.WriteAsJsonAsync(new { message = "Password change required before continuing." });
            return;
        }

        await _next(context);
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Erp.Infrastructure.Tenancy;

// Reads tenant_id straight out of the validated JWT — never from a header, query string,
// or request body the caller controls. That's what stops one tenant's user from ever
// pointing requests at another tenant's data by just changing a parameter.
public class JwtTenantContext : ITenantContext
{
    public Guid TenantId { get; }
    public bool IsResolved { get; }

    public JwtTenantContext(IHttpContextAccessor accessor)
    {
        var claim = accessor.HttpContext?.User?.FindFirstValue("tenant_id");
        if (Guid.TryParse(claim, out var id))
        {
            TenantId = id;
            IsResolved = true;
        }
    }
}

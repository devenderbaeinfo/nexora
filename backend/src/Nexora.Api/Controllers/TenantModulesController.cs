using Nexora.Api.Persistence;
using Nexora.Shared.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/tenants/current")]
public class TenantModulesController : ControllerBase
{
    private readonly NexoraDbContext _db;
    private readonly ITenantContext _tenant;
    public TenantModulesController(NexoraDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    // Any authenticated tenant user can read their own tenant's active module keys — the
    // frontend uses this to decide what to show in the nav (AppShell). No permission gate:
    // the backend's own [RequireModule] on each controller is the real enforcement boundary,
    // this is just so the UI doesn't dangle links to features the client hasn't bought.
    // TenantModule isn't a TenantEntity (see Plan.cs) so it carries no automatic query filter —
    // the TenantId filter below is load-bearing, not redundant.
    [HttpGet("modules")]
    public async Task<ActionResult<string[]>> GetActiveModules()
    {
        var keys = await _db.Set<TenantModule>()
            .Where(tm => tm.TenantId == _tenant.TenantId)
            .Select(tm => tm.ModuleKey)
            .ToArrayAsync();
        return Ok(keys);
    }
}

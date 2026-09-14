using Nexora.Shared.Authorization;
using Nexora.Modules.Platform.Services;
using Nexora.Modules.Identity.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Nexora.Modules.Platform.Controllers;

public record BillingProviderStatusDto(string ProviderName, bool IsConnected);

// PLT-5: lets the Admin billing pages show which payment processor (if any) is actually
// wired up, without those pages needing to know how. See IBillingProviderGateway.
[ApiController]
[Authorize]
[Route("api/platform/billing")]
public class PlatformBillingController : ControllerBase
{
    private readonly IBillingProviderGateway _gateway;
    public PlatformBillingController(IBillingProviderGateway gateway) => _gateway = gateway;

    [HttpGet("provider-status")]
    [RequirePermission(Permission.Platform.ManageTenants)]
    public async Task<ActionResult<BillingProviderStatusDto>> ProviderStatus()
    {
        var status = await _gateway.GetProviderStatusAsync();
        return Ok(new BillingProviderStatusDto(status.ProviderName, status.IsConnected));
    }
}

using Erp.Api.Authorization;
using Erp.Application.Billing;
using Erp.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Controllers;

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

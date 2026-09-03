namespace Erp.Application.Billing;

// PLT-5: a seam for a real payment processor (Stripe, Razorpay, etc.) to slot into later,
// without the Admin billing screens (or anything else) needing to change when it does.
// Nothing here talks to a real processor yet — see ManualBillingProviderGateway.
public record BillingProviderStatus(string ProviderName, bool IsConnected);

public record BillingChargeResult(bool Succeeded, string? ExternalReference, string? FailureReason);

public interface IBillingProviderGateway
{
    Task<BillingProviderStatus> GetProviderStatusAsync();

    // Amount is always in the tenant's base currency — same convention as everywhere else
    // money crosses a service boundary in this codebase (see Tenant.BaseCurrencyCode).
    Task<BillingChargeResult> CreateChargeAsync(Guid tenantId, decimal amount, string memo);
}

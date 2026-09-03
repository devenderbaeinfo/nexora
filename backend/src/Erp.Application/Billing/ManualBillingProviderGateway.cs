namespace Erp.Application.Billing;

// The only implementation today: invoices/payments are tracked and reconciled by hand,
// same as before this interface existed. Swapping in a real processor later is a matter of
// adding a new IBillingProviderGateway implementation and changing one DI registration —
// nothing else in the app (controllers, the Admin billing pages) needs to know it happened.
public class ManualBillingProviderGateway : IBillingProviderGateway
{
    public Task<BillingProviderStatus> GetProviderStatusAsync() =>
        Task.FromResult(new BillingProviderStatus("Manual", IsConnected: false));

    public Task<BillingChargeResult> CreateChargeAsync(Guid tenantId, decimal amount, string memo) =>
        Task.FromResult(new BillingChargeResult(
            Succeeded: false,
            ExternalReference: null,
            FailureReason: "No billing provider is connected. Record this payment manually."));
}

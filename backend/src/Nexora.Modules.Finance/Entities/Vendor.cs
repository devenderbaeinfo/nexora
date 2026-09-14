using Nexora.Shared.Common;

namespace Nexora.Modules.Finance.Entities;

// The counterparty on a VendorBill — deliberately minimal (no payment-terms/tax-jurisdiction
// modeling), matching how Customer.cs stays minimal on the AR side of this codebase.
public class Vendor : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public bool IsActive { get; set; } = true;
}

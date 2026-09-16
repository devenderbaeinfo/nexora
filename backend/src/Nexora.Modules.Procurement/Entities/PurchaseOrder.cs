using Nexora.Shared.Common;

namespace Nexora.Modules.Procurement.Entities;

public class PurchaseOrder : TenantEntity
{
    public string VendorName { get; set; } = default!;
    public string Description { get; set; } = default!;
    public decimal Amount { get; set; }
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public DateOnly OrderDate { get; set; }
}

public enum PurchaseOrderStatus
{
    Draft,
    Submitted,
    Approved,
    Received
}

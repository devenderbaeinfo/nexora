using Nexora.Shared.Common;

namespace Nexora.Modules.Inventory.Entities;

public class StockItem : TenantEntity
{
    public string Sku { get; set; } = default!;
    public string Name { get; set; } = default!;
    public int QuantityOnHand { get; set; }
    public int ReorderLevel { get; set; }
    public decimal UnitPrice { get; set; }
}

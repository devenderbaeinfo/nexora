using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Inventory.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Inventory.Controllers;

public record StockItemDto(Guid Id, string Sku, string Name, int QuantityOnHand, int ReorderLevel, decimal UnitPrice);
public record CreateStockItemRequest(string Sku, string Name, int QuantityOnHand, int ReorderLevel, decimal UnitPrice);

[ApiController]
[Authorize]
[Route("api/inventory/stock-items")]
public class StockItemsController : ControllerBase
{
    private readonly DbContext _db;
    public StockItemsController(DbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Inventory.View)]
    public async Task<ActionResult<List<StockItemDto>>> List()
    {
        var items = await _db.Set<StockItem>()
            .OrderBy(i => i.Name)
            .Select(i => new StockItemDto(i.Id, i.Sku, i.Name, i.QuantityOnHand, i.ReorderLevel, i.UnitPrice))
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost]
    [RequirePermission(Permission.Inventory.Manage)]
    public async Task<ActionResult<StockItemDto>> Create(CreateStockItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Sku)) return BadRequest("SKU is required.");
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");
        if (request.QuantityOnHand < 0) return BadRequest("Quantity on hand can't be negative.");
        if (request.ReorderLevel < 0) return BadRequest("Reorder level can't be negative.");
        if (request.UnitPrice < 0) return BadRequest("Unit price can't be negative.");

        var skuInUse = await _db.Set<StockItem>().AnyAsync(i => i.Sku == request.Sku.Trim());
        if (skuInUse) return Conflict("A stock item with this SKU already exists.");

        var item = new StockItem
        {
            Sku = request.Sku.Trim(),
            Name = request.Name.Trim(),
            QuantityOnHand = request.QuantityOnHand,
            ReorderLevel = request.ReorderLevel,
            UnitPrice = request.UnitPrice,
        };
        _db.Set<StockItem>().Add(item);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new StockItemDto(item.Id, item.Sku, item.Name, item.QuantityOnHand, item.ReorderLevel, item.UnitPrice));
    }
}

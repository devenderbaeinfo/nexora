using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Procurement.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Procurement.Controllers;

public record PurchaseOrderDto(Guid Id, string VendorName, string Description, decimal Amount, string Status, DateOnly OrderDate);
public record CreatePurchaseOrderRequest(string VendorName, string Description, decimal Amount, DateOnly OrderDate);

[ApiController]
[Authorize]
[Route("api/procurement/purchase-orders")]
public class PurchaseOrdersController : ControllerBase
{
    private readonly DbContext _db;
    public PurchaseOrdersController(DbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Procurement.View)]
    public async Task<ActionResult<List<PurchaseOrderDto>>> List()
    {
        var orders = await _db.Set<PurchaseOrder>()
            .OrderByDescending(o => o.OrderDate)
            .Select(o => new PurchaseOrderDto(o.Id, o.VendorName, o.Description, o.Amount, o.Status.ToString(), o.OrderDate))
            .ToListAsync();
        return Ok(orders);
    }

    [HttpPost]
    [RequirePermission(Permission.Procurement.Manage)]
    public async Task<ActionResult<PurchaseOrderDto>> Create(CreatePurchaseOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.VendorName)) return BadRequest("Vendor name is required.");
        if (string.IsNullOrWhiteSpace(request.Description)) return BadRequest("Description is required.");
        if (request.Amount < 0) return BadRequest("Amount can't be negative.");

        var order = new PurchaseOrder
        {
            VendorName = request.VendorName.Trim(),
            Description = request.Description.Trim(),
            Amount = request.Amount,
            OrderDate = request.OrderDate,
        };
        _db.Set<PurchaseOrder>().Add(order);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new PurchaseOrderDto(order.Id, order.VendorName, order.Description, order.Amount, order.Status.ToString(), order.OrderDate));
    }
}

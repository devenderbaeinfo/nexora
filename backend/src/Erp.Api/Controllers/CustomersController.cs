using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Identity;
using Erp.Domain.Project;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/customers")]
public class CustomersController : ControllerBase
{
    private readonly ErpDbContext _db;
    public CustomersController(ErpDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<CustomerDto>>> List()
    {
        var customers = await _db.Customers
            .OrderBy(c => c.Name)
            .Select(c => new CustomerDto(c.Id, c.Name, c.ContactEmail))
            .ToListAsync();
        return Ok(customers);
    }

    [HttpPost]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<ActionResult<CustomerDto>> Create(CreateCustomerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");
        if (request.Name.Trim().Length > 200) return BadRequest("Name can't be longer than 200 characters.");

        var customer = new Customer { Name = request.Name.Trim(), ContactEmail = request.ContactEmail, ContactPhone = request.ContactPhone };
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new CustomerDto(customer.Id, customer.Name, customer.ContactEmail));
    }
}

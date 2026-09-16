using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Sales.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Sales.Controllers;

public record LeadDto(Guid Id, string CompanyName, string ContactName, string ContactEmail, decimal EstimatedValue, string Stage, DateTimeOffset CreatedAtUtc);
public record CreateLeadRequest(string CompanyName, string ContactName, string ContactEmail, decimal EstimatedValue);

[ApiController]
[Authorize]
[Route("api/sales/leads")]
public class LeadsController : ControllerBase
{
    private readonly DbContext _db;
    public LeadsController(DbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Sales.View)]
    public async Task<ActionResult<List<LeadDto>>> List()
    {
        var leads = await _db.Set<Lead>()
            .OrderByDescending(l => l.CreatedAtUtc)
            .Select(l => new LeadDto(l.Id, l.CompanyName, l.ContactName, l.ContactEmail, l.EstimatedValue, l.Stage.ToString(), l.CreatedAtUtc))
            .ToListAsync();
        return Ok(leads);
    }

    [HttpPost]
    [RequirePermission(Permission.Sales.Manage)]
    public async Task<ActionResult<LeadDto>> Create(CreateLeadRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CompanyName)) return BadRequest("Company name is required.");
        if (string.IsNullOrWhiteSpace(request.ContactName)) return BadRequest("Contact name is required.");
        if (string.IsNullOrWhiteSpace(request.ContactEmail)) return BadRequest("Contact email is required.");
        if (request.EstimatedValue < 0) return BadRequest("Estimated value can't be negative.");

        var lead = new Lead
        {
            CompanyName = request.CompanyName.Trim(),
            ContactName = request.ContactName.Trim(),
            ContactEmail = request.ContactEmail.Trim(),
            EstimatedValue = request.EstimatedValue,
        };
        _db.Set<Lead>().Add(lead);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new LeadDto(lead.Id, lead.CompanyName, lead.ContactName, lead.ContactEmail, lead.EstimatedValue, lead.Stage.ToString(), lead.CreatedAtUtc));
    }
}

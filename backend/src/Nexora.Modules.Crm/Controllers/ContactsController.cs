using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Crm.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Crm.Controllers;

public record ContactDto(Guid Id, string FullName, string CompanyName, string Email, string? Phone, string Type);
public record CreateContactRequest(string FullName, string CompanyName, string Email, string? Phone, string Type);

[ApiController]
[Authorize]
[Route("api/crm/contacts")]
public class ContactsController : ControllerBase
{
    private readonly DbContext _db;
    public ContactsController(DbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.Crm.View)]
    public async Task<ActionResult<List<ContactDto>>> List()
    {
        var contacts = await _db.Set<Contact>()
            .OrderBy(c => c.FullName)
            .Select(c => new ContactDto(c.Id, c.FullName, c.CompanyName, c.Email, c.Phone, c.Type.ToString()))
            .ToListAsync();
        return Ok(contacts);
    }

    [HttpPost]
    [RequirePermission(Permission.Crm.Manage)]
    public async Task<ActionResult<ContactDto>> Create(CreateContactRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName)) return BadRequest("Full name is required.");
        if (string.IsNullOrWhiteSpace(request.Email)) return BadRequest("Email is required.");
        if (!Enum.TryParse<ContactType>(request.Type, out var type)) return BadRequest("Unknown contact type.");

        var contact = new Contact
        {
            FullName = request.FullName.Trim(),
            CompanyName = request.CompanyName?.Trim() ?? "",
            Email = request.Email.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Type = type,
        };
        _db.Set<Contact>().Add(contact);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new ContactDto(contact.Id, contact.FullName, contact.CompanyName, contact.Email, contact.Phone, contact.Type.ToString()));
    }
}

using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Api.Contracts;
using Nexora.Shared.Announcements;
using Nexora.Modules.Identity.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/announcements")]
public class AnnouncementsController : ControllerBase
{
    private readonly NexoraDbContext _db;
    public AnnouncementsController(NexoraDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    // Every authenticated tenant user can read these — no permission gate here on purpose,
    // pinned policies first so POSH/leave-conditions-type content doesn't scroll off.
    [HttpGet]
    public async Task<ActionResult<List<AnnouncementDto>>> List()
    {
        var announcements = await _db.Announcements
            .OrderByDescending(a => a.IsPinned)
            .ThenByDescending(a => a.CreatedAtUtc)
            .ToListAsync();

        return Ok(announcements.Select(ToDto).ToList());
    }

    [HttpPost]
    [RequirePermission(Permission.Announcements.Manage)]
    public async Task<IActionResult> Create(UpsertAnnouncementRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Body))
            return BadRequest("Title and body are required.");

        var announcement = new Announcement
        {
            Title = request.Title,
            Body = request.Body,
            Category = request.Category,
            IsPinned = request.IsPinned,
            PublishedByUserId = CurrentUserId,
        };
        _db.Announcements.Add(announcement);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), null, ToDto(announcement));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission(Permission.Announcements.Manage)]
    public async Task<IActionResult> Update(Guid id, UpsertAnnouncementRequest request)
    {
        var announcement = await _db.Announcements.FirstOrDefaultAsync(a => a.Id == id);
        if (announcement is null) return NotFound();

        announcement.Title = request.Title;
        announcement.Body = request.Body;
        announcement.Category = request.Category;
        announcement.IsPinned = request.IsPinned;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission(Permission.Announcements.Manage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var announcement = await _db.Announcements.FirstOrDefaultAsync(a => a.Id == id);
        if (announcement is null) return NotFound();

        announcement.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static AnnouncementDto ToDto(Announcement a) =>
        new(a.Id, a.Title, a.Body, a.Category.ToString(), a.IsPinned, a.CreatedAtUtc);
}

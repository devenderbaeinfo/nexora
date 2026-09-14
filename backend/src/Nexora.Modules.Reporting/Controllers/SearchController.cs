using Nexora.Modules.Identity.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Reporting.Controllers;

public record SearchResultDto(string Kind, string Title, string Subtitle, Guid Id, string LinkPath);

// Backs the Ctrl+K command palette. Two sources for now (People, Projects) — each gated by
// the same permission its own list page already requires, so search never surfaces something
// the caller couldn't otherwise see.
[ApiController]
[Authorize]
[Route("api/search")]
public class SearchController : ControllerBase
{
    private readonly NexoraDbContext _db;
    public SearchController(NexoraDbContext db) => _db = db;

    private bool Has(string perm) => User.HasClaim("perm", perm);

    [HttpGet]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("search")]
    public async Task<ActionResult<List<SearchResultDto>>> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2) return Ok(new List<SearchResultDto>());
        var term = q.Trim();

        var results = new List<SearchResultDto>();

        if (Has(Permission.People.View))
        {
            var employees = await _db.Employees
                .Where(e => EF.Functions.Like(e.FirstName + " " + e.LastName, $"%{term}%") || EF.Functions.Like(e.WorkEmail, $"%{term}%"))
                .OrderBy(e => e.FirstName)
                .Take(6)
                .ToListAsync();

            results.AddRange(employees.Select(e => new SearchResultDto("Employee", $"{e.FirstName} {e.LastName}", e.WorkEmail, e.Id, "/")));
        }

        if (Has(Permission.Project.View))
        {
            var projects = await _db.Projects
                .Where(p => EF.Functions.Like(p.Name, $"%{term}%"))
                .OrderBy(p => p.Name)
                .Take(6)
                .ToListAsync();

            results.AddRange(projects.Select(p => new SearchResultDto("Project", p.Name, p.Status.ToString(), p.Id, "/projects")));
        }

        return Ok(results);
    }
}

using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Company.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Company.Controllers;

public record DepartmentDto(Guid Id, string Name);
public record CreateDepartmentRequest(string Name);

[ApiController]
[Authorize]
[Route("api/departments")]
public class DepartmentsController : ControllerBase
{
    private readonly DbContext _db;
    public DepartmentsController(DbContext db) => _db = db;

    [HttpGet]
    [RequirePermission(Permission.People.View)]
    public async Task<ActionResult<List<DepartmentDto>>> List()
    {
        var departments = await _db.Set<Department>()
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentDto(d.Id, d.Name))
            .ToListAsync();
        return Ok(departments);
    }

    [HttpPost]
    [RequirePermission(Permission.Admin.ManageOrgStructure)]
    public async Task<ActionResult<DepartmentDto>> Create(CreateDepartmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");
        if (request.Name.Trim().Length > 200) return BadRequest("Name can't be longer than 200 characters.");

        var department = new Department { Name = request.Name.Trim() };
        _db.Set<Department>().Add(department);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new DepartmentDto(department.Id, department.Name));
    }
}

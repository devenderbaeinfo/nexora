using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Api.Services;
using Erp.Domain.Audit;
using Erp.Domain.Identity;
using Erp.Domain.People;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/employee-documents")]
public class EmployeeDocumentsController : ControllerBase
{
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf", "image/jpeg", "image/png",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    private readonly ErpDbContext _db;
    private readonly EmployeeDocumentStorage _storage;

    public EmployeeDocumentsController(ErpDbContext db, EmployeeDocumentStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id")!);

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private bool CanManage => User.HasClaim("perm", Permission.EmployeeDocs.Manage);

    [HttpGet("mine")]
    [RequirePermission(Permission.EmployeeDocs.View)]
    public async Task<ActionResult<List<EmployeeDocumentDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<EmployeeDocumentDto>());
        return Ok(await BuildDtos(_db.EmployeeDocuments.Where(d => d.EmployeeId == employeeId)));
    }

    [HttpGet("employees/{employeeId:guid}")]
    [RequirePermission(Permission.EmployeeDocs.View)]
    public async Task<ActionResult<List<EmployeeDocumentDto>>> ForEmployee(Guid employeeId)
    {
        if (!CanManage && employeeId != CurrentEmployeeId) return Forbid();
        return Ok(await BuildDtos(_db.EmployeeDocuments.Where(d => d.EmployeeId == employeeId)));
    }

    [HttpPost]
    [RequirePermission(Permission.EmployeeDocs.Manage)]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> Upload([FromForm] Guid employeeId, [FromForm] EmployeeDocumentType type,
        [FromForm] DateOnly? expiresOn, IFormFile file)
    {
        if (file.Length == 0) return BadRequest("File is empty.");
        if (file.Length > MaxFileSizeBytes) return BadRequest("File exceeds the 10 MB limit.");
        if (!AllowedContentTypes.Contains(file.ContentType)) return BadRequest("Unsupported file type.");

        var employeeExists = await _db.Employees.AnyAsync(e => e.Id == employeeId);
        if (!employeeExists) return BadRequest("Unknown employee.");

        var storedFileName = await _storage.SaveAsync(TenantId, file);

        var document = new EmployeeDocument
        {
            EmployeeId = employeeId,
            Type = type,
            OriginalFileName = file.FileName,
            StoredFileName = storedFileName,
            ContentType = file.ContentType,
            SizeBytes = file.Length,
            ExpiresOn = expiresOn,
            UploadedByUserId = CurrentUserId,
        };
        _db.EmployeeDocuments.Add(document);

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "employee_docs.upload",
            EntityType = "EmployeeDocument",
            EntityId = document.Id,
        });

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(ForEmployee), new { employeeId }, null);
    }

    [HttpGet("{id:guid}/download")]
    [RequirePermission(Permission.EmployeeDocs.View)]
    public async Task<IActionResult> Download(Guid id)
    {
        var document = await _db.EmployeeDocuments.FirstOrDefaultAsync(d => d.Id == id);
        if (document is null) return NotFound();
        if (!CanManage && document.EmployeeId != CurrentEmployeeId) return Forbid();

        var path = _storage.GetPath(TenantId, document.StoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound();

        return PhysicalFile(path, document.ContentType, document.OriginalFileName);
    }

    [HttpPatch("{id:guid}")]
    [RequirePermission(Permission.EmployeeDocs.Manage)]
    public async Task<IActionResult> Verify(Guid id, VerifyEmployeeDocumentRequest request)
    {
        var document = await _db.EmployeeDocuments.FirstOrDefaultAsync(d => d.Id == id);
        if (document is null) return NotFound();

        document.Status = request.Status;

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "employee_docs.verify",
            EntityType = "EmployeeDocument",
            EntityId = document.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<List<EmployeeDocumentDto>> BuildDtos(IQueryable<EmployeeDocument> query)
    {
        var documents = await query.OrderByDescending(d => d.CreatedAtUtc).ToListAsync();
        var employees = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return documents.Select(d => new EmployeeDocumentDto(
            d.Id, d.EmployeeId, employees.TryGetValue(d.EmployeeId, out var name) ? name : "—",
            d.Type.ToString(), d.OriginalFileName, d.ContentType, d.SizeBytes,
            d.Status.ToString(), d.ExpiresOn, d.CreatedAtUtc)).ToList();
    }
}

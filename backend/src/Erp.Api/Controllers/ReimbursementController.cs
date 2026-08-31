using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Audit;
using Erp.Domain.Identity;
using Erp.Domain.Reimbursement;
using Erp.Domain.Workflow;
using Erp.Infrastructure.Persistence;
using Erp.Infrastructure.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// Same Manager -> Finance shape as Leave's Manager -> HR chain, and deliberately built the
// same way call-for-call: proof that ApprovalWorkflowService actually generalizes rather
// than being leave-shaped in disguise.
[ApiController]
[Authorize]
[Route("api/reimbursements")]
public class ReimbursementController : ControllerBase
{
    private readonly ErpDbContext _db;
    private readonly IApprovalWorkflowService _workflow;

    public ReimbursementController(ErpDbContext db, IApprovalWorkflowService workflow)
    {
        _db = db;
        _workflow = workflow;
    }

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("mine")]
    [RequirePermission(Permission.Expense.View)]
    public async Task<ActionResult<List<ReimbursementDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<ReimbursementDto>());
        return Ok(await BuildDtos(_db.ReimbursementRequests.Where(r => r.EmployeeId == employeeId)));
    }

    [HttpGet("pending-manager-approval")]
    [RequirePermission(Permission.Expense.ApproveAsManager)]
    public async Task<ActionResult<List<ReimbursementDto>>> PendingManagerApproval()
    {
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<ReimbursementDto>());

        var directReportIds = await _db.Employees
            .Where(e => e.ReportingManagerId == managerId)
            .Select(e => e.Id)
            .ToListAsync();

        return Ok(await BuildDtos(_db.ReimbursementRequests
            .Where(r => directReportIds.Contains(r.EmployeeId) && r.Status == ReimbursementStatus.Pending)));
    }

    [HttpGet("pending-finance-approval")]
    [RequirePermission(Permission.Expense.ApproveAsFinance)]
    public async Task<ActionResult<List<ReimbursementDto>>> PendingFinanceApproval()
    {
        // Finance's queue is company-wide — the final gate after a request has cleared its own manager.
        return Ok(await BuildDtos(_db.ReimbursementRequests.Where(r => r.Status == ReimbursementStatus.ManagerApproved)));
    }

    // Every reimbursement from a manager's direct reports, any status — not just the pending
    // ones — for the "My Team Expenses" overview rather than just the approval queue.
    [HttpGet("team")]
    [RequirePermission(Permission.Expense.ApproveAsManager)]
    public async Task<ActionResult<List<ReimbursementDto>>> Team()
    {
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<ReimbursementDto>());

        var directReportIds = await _db.Employees
            .Where(e => e.ReportingManagerId == managerId)
            .Select(e => e.Id)
            .ToListAsync();

        return Ok(await BuildDtos(_db.ReimbursementRequests.Where(r => directReportIds.Contains(r.EmployeeId))));
    }

    private async Task<List<ReimbursementDto>> BuildDtos(IQueryable<ReimbursementRequest> query)
    {
        var requests = await query.OrderByDescending(r => r.CreatedAtUtc).ToListAsync();
        var employees = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return requests.Select(r => new ReimbursementDto(
            r.Id,
            employees.TryGetValue(r.EmployeeId, out var name) ? name : "—",
            r.Amount, r.Category, r.Description, r.IncurredOn, r.Status.ToString())).ToList();
    }

    [HttpPost]
    [RequirePermission(Permission.Expense.Submit)]
    public async Task<IActionResult> Submit(SubmitReimbursementRequest request)
    {
        if (CurrentEmployeeId is not { } employeeId)
            return BadRequest("This account isn't linked to an employee record yet.");

        if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.Category)) return BadRequest("Category is required.");
        if (request.IncurredOn > DateOnly.FromDateTime(DateTime.UtcNow)) return BadRequest("Incurred date can't be in the future.");

        var reimbursement = new ReimbursementRequest
        {
            EmployeeId = employeeId,
            Amount = request.Amount,
            Category = request.Category.Trim(),
            Description = request.Description,
            ReceiptUrl = request.ReceiptUrl,
            IncurredOn = request.IncurredOn,
        };
        _db.ReimbursementRequests.Add(reimbursement);
        await _db.SaveChangesAsync();

        var workflow = await _workflow.StartAsync(WorkflowDefinitions.Reimbursement, reimbursement.Id);
        reimbursement.WorkflowInstanceId = workflow.Id;
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Mine), new { id = reimbursement.Id });
    }

    [HttpPost("{id:guid}/decision")]
    [Authorize]
    public async Task<IActionResult> Decide(Guid id, DecideReimbursementRequest decision)
    {
        var reimbursement = await _db.ReimbursementRequests.FirstOrDefaultAsync(r => r.Id == id);
        if (reimbursement is null) return NotFound();

        var workflow = await _workflow.GetAsync(reimbursement.WorkflowInstanceId);
        if (workflow?.CurrentStage is not { } stage) return Conflict("This request has already been fully decided.");

        return stage switch
        {
            "Manager" => await DecideAsManager(reimbursement, decision),
            "Finance" => await DecideAsFinance(reimbursement, decision),
            _ => Conflict("Unknown workflow stage."),
        };
    }

    private async Task<IActionResult> DecideAsManager(ReimbursementRequest reimbursement, DecideReimbursementRequest decision)
    {
        if (!User.HasClaim("perm", Permission.Expense.ApproveAsManager)) return Forbid();

        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == reimbursement.EmployeeId);
        if (employee?.ReportingManagerId != CurrentEmployeeId)
        {
            await LogDenied("expense.approve_as_manager", reimbursement.Id);
            return Forbid();
        }

        var outcome = await _workflow.DecideAsync(reimbursement.WorkflowInstanceId, "Manager", CurrentUserId, decision.Approve, decision.Note);
        if (!outcome.Applied) return Conflict(outcome.Reason);

        reimbursement.Status = outcome.IsRejected ? ReimbursementStatus.Rejected : ReimbursementStatus.ManagerApproved;

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "expense.approve_as_manager" : "expense.reject_as_manager",
            EntityType = "ReimbursementRequest",
            EntityId = reimbursement.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IActionResult> DecideAsFinance(ReimbursementRequest reimbursement, DecideReimbursementRequest decision)
    {
        if (!User.HasClaim("perm", Permission.Expense.ApproveAsFinance)) return Forbid();

        var outcome = await _workflow.DecideAsync(reimbursement.WorkflowInstanceId, "Finance", CurrentUserId, decision.Approve, decision.Note);
        if (!outcome.Applied) return Conflict(outcome.Reason);

        reimbursement.Status = outcome.IsRejected ? ReimbursementStatus.Rejected : ReimbursementStatus.Approved;
        if (outcome.IsFullyApproved)
        {
            reimbursement.PostedForPayment = true; // stands in for a real accounting entry until that module exists
        }

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "expense.approve_as_finance" : "expense.reject_as_finance",
            EntityType = "ReimbursementRequest",
            EntityId = reimbursement.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task LogDenied(string action, Guid entityId)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = action,
            EntityType = "ReimbursementRequest",
            EntityId = entityId,
            WasDenied = true,
        });
        await _db.SaveChangesAsync();
    }
}

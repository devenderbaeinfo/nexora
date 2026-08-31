using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Audit;
using Erp.Domain.Identity;
using Erp.Domain.Project;
using Erp.Domain.Workflow;
using Erp.Infrastructure.Persistence;
using Erp.Infrastructure.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// Third module on the shared engine — and the first where the "manager" stage is authorized
// by a genuinely different rule than Leave/Reimbursement: it's whoever the specific project's
// ProjectManagerId points to, not the submitter's own reporting manager. That's exactly the
// kind of domain rule the engine was designed to leave outside itself.
[ApiController]
[Authorize]
[Route("api/project-expenses")]
public class ProjectExpensesController : ControllerBase
{
    private readonly ErpDbContext _db;
    private readonly IApprovalWorkflowService _workflow;

    public ProjectExpensesController(ErpDbContext db, IApprovalWorkflowService workflow)
    {
        _db = db;
        _workflow = workflow;
    }

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("mine")]
    [RequirePermission(Permission.Project.SubmitExpense)]
    public async Task<ActionResult<List<ProjectExpenseDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<ProjectExpenseDto>());
        return Ok(await BuildDtos(_db.ProjectExpenses.Where(e => e.EmployeeId == employeeId)));
    }

    [HttpGet("pending-pm-approval")]
    [RequirePermission(Permission.Project.ApproveExpenseAsProjectManager)]
    public async Task<ActionResult<List<ProjectExpenseDto>>> PendingProjectManagerApproval()
    {
        if (CurrentEmployeeId is not { } pmId) return Ok(new List<ProjectExpenseDto>());

        var myProjectIds = await _db.Projects.Where(p => p.ProjectManagerId == pmId).Select(p => p.Id).ToListAsync();
        return Ok(await BuildDtos(_db.ProjectExpenses
            .Where(e => myProjectIds.Contains(e.ProjectId) && e.Status == ProjectExpenseStatus.Pending)));
    }

    [HttpGet("pending-finance-approval")]
    [RequirePermission(Permission.Project.ApproveExpenseAsFinance)]
    public async Task<ActionResult<List<ProjectExpenseDto>>> PendingFinanceApproval()
    {
        return Ok(await BuildDtos(_db.ProjectExpenses.Where(e => e.Status == ProjectExpenseStatus.ManagerApproved)));
    }

    private async Task<List<ProjectExpenseDto>> BuildDtos(IQueryable<ProjectExpense> query)
    {
        var expenses = await query.OrderByDescending(e => e.CreatedAtUtc).ToListAsync();
        var projects = await _db.Projects.ToDictionaryAsync(p => p.Id, p => p.Name);
        var employees = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return expenses.Select(e => new ProjectExpenseDto(
            e.Id,
            projects.TryGetValue(e.ProjectId, out var pName) ? pName : "—",
            employees.TryGetValue(e.EmployeeId, out var eName) ? eName : "—",
            e.Amount, e.Category, e.Description, e.IncurredOn, e.IsBillable, e.Status.ToString())).ToList();
    }

    [HttpPost]
    [RequirePermission(Permission.Project.SubmitExpense)]
    public async Task<IActionResult> Submit(SubmitProjectExpenseRequest request)
    {
        if (CurrentEmployeeId is not { } employeeId)
            return BadRequest("This account isn't linked to an employee record yet.");

        if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.Category)) return BadRequest("Category is required.");
        if (request.IncurredOn > DateOnly.FromDateTime(DateTime.UtcNow)) return BadRequest("Incurred date can't be in the future.");

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId);
        if (project is null) return BadRequest("Unknown project.");

        var expense = new ProjectExpense
        {
            ProjectId = request.ProjectId,
            EmployeeId = employeeId,
            Amount = request.Amount,
            Category = request.Category.Trim(),
            Description = request.Description,
            IncurredOn = request.IncurredOn,
            IsBillable = request.IsBillable,
        };
        _db.ProjectExpenses.Add(expense);
        await _db.SaveChangesAsync();

        var workflow = await _workflow.StartAsync(WorkflowDefinitions.ProjectExpense, expense.Id);
        expense.WorkflowInstanceId = workflow.Id;
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Mine), new { id = expense.Id });
    }

    [HttpPost("{id:guid}/decision")]
    [Authorize]
    public async Task<IActionResult> Decide(Guid id, DecideProjectExpenseRequest decision)
    {
        var expense = await _db.ProjectExpenses.FirstOrDefaultAsync(e => e.Id == id);
        if (expense is null) return NotFound();

        var workflow = await _workflow.GetAsync(expense.WorkflowInstanceId);
        if (workflow?.CurrentStage is not { } stage) return Conflict("This expense has already been fully decided.");

        return stage switch
        {
            "ProjectManager" => await DecideAsProjectManager(expense, decision),
            "Finance" => await DecideAsFinance(expense, decision),
            _ => Conflict("Unknown workflow stage."),
        };
    }

    private async Task<IActionResult> DecideAsProjectManager(ProjectExpense expense, DecideProjectExpenseRequest decision)
    {
        if (!User.HasClaim("perm", Permission.Project.ApproveExpenseAsProjectManager)) return Forbid();

        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == expense.ProjectId);
        if (project?.ProjectManagerId != CurrentEmployeeId)
        {
            await LogDenied("project.approve_expense_as_pm", expense.Id);
            return Forbid();
        }

        var outcome = await _workflow.DecideAsync(expense.WorkflowInstanceId, "ProjectManager", CurrentUserId, decision.Approve, decision.Note);
        if (!outcome.Applied) return Conflict(outcome.Reason);

        expense.Status = outcome.IsRejected ? ProjectExpenseStatus.Rejected : ProjectExpenseStatus.ManagerApproved;

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "project.approve_expense_as_pm" : "project.reject_expense_as_pm",
            EntityType = "ProjectExpense",
            EntityId = expense.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IActionResult> DecideAsFinance(ProjectExpense expense, DecideProjectExpenseRequest decision)
    {
        if (!User.HasClaim("perm", Permission.Project.ApproveExpenseAsFinance)) return Forbid();

        var outcome = await _workflow.DecideAsync(expense.WorkflowInstanceId, "Finance", CurrentUserId, decision.Approve, decision.Note);
        if (!outcome.Applied) return Conflict(outcome.Reason);

        expense.Status = outcome.IsRejected ? ProjectExpenseStatus.Rejected : ProjectExpenseStatus.Approved;

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "project.approve_expense_as_finance" : "project.reject_expense_as_finance",
            EntityType = "ProjectExpense",
            EntityId = expense.Id,
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
            EntityType = "ProjectExpense",
            EntityId = entityId,
            WasDenied = true,
        });
        await _db.SaveChangesAsync();
    }
}

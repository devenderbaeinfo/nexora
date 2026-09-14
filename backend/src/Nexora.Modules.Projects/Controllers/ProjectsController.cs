using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.Projects.Contracts;
using Nexora.Modules.Identity.Authorization;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Projects.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Projects.Controllers;

[ApiController]
[Authorize]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly DbContext _db;
    private readonly IDataScopeService _scope;
    public ProjectsController(DbContext db, IDataScopeService scope)
    {
        _db = db;
        _scope = scope;
    }

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    // null = unrestricted ("All"). A non-null (possibly empty) set is the exact allowlist
    // of project ids this caller's role permits for Permission.Project.View.
    private async Task<HashSet<Guid>?> ResolveAllowedProjectIdsAsync(ScopeDecision decision)
    {
        switch (decision.Type)
        {
            case DataScopeType.All:
                return null;

            case DataScopeType.Specific:
                return decision.SpecificIds.ToHashSet();

            case DataScopeType.Mine:
            {
                if (CurrentEmployeeId is not { } employeeId) return [];
                var memberIds = await _db.Set<ProjectMember>().Where(m => m.EmployeeId == employeeId).Select(m => m.ProjectId).ToListAsync();
                var managedIds = await _db.Set<ProjectEntity>().Where(p => p.ProjectManagerId == employeeId).Select(p => p.Id).ToListAsync();
                return memberIds.Concat(managedIds).ToHashSet();
            }

            case DataScopeType.Department:
            {
                if (CurrentEmployeeId is not { } employeeId) return [];
                var me = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == employeeId);
                if (me is null) return [];
                var peerIds = await _db.Set<Employee>().Where(e => e.DepartmentId == me.DepartmentId).Select(e => e.Id).ToListAsync();
                var ids = await _db.Set<ProjectEntity>().Where(p => peerIds.Contains(p.ProjectManagerId)).Select(p => p.Id).ToListAsync();
                return ids.ToHashSet();
            }

            default:
                return [];
        }
    }

    // The projects an employee is actually involved in — staffed on (ProjectMember) or
    // managing (Projects.ProjectManagerId) — not just the ones they merely have view rights
    // to. A Manager who manages a project but was never separately added as a ProjectMember
    // used to be invisible here entirely; this is "My Projects"/"My Work" for everyone.
    [HttpGet("mine")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<MyProjectDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<MyProjectDto>());

        var memberships = await _db.Set<ProjectMember>().Where(m => m.EmployeeId == employeeId).ToListAsync();
        var roleByProjectId = memberships.ToDictionary(m => m.ProjectId, m => m.RoleOnProject);
        var managedProjectIds = await _db.Set<ProjectEntity>().Where(p => p.ProjectManagerId == employeeId).Select(p => p.Id).ToListAsync();

        var projectIds = roleByProjectId.Keys.Union(managedProjectIds).ToList();
        var projects = await _db.Set<ProjectEntity>().Where(p => projectIds.Contains(p.Id)).ToListAsync();
        var customers = await _db.Set<Customer>().ToDictionaryAsync(c => c.Id, c => c.Name);

        return Ok(projects.Select(project => new MyProjectDto(
            project.Id, project.Name,
            customers.TryGetValue(project.CustomerId, out var name) ? name : "—",
            project.Status.ToString(),
            // Their staffed role is more specific when both apply; otherwise they're here
            // purely because they manage it.
            roleByProjectId.TryGetValue(project.Id, out var role) ? role : "Project Manager")).ToList());
    }

    [HttpGet]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectDto>>> List()
    {
        var scopeDecision = await _scope.ResolveAsync(User, Permission.Project.View);
        var allowedIds = await ResolveAllowedProjectIdsAsync(scopeDecision);
        var budgetAccess = await _scope.FieldAccessAsync(User, "Project", "BudgetAmount");

        var customers = await _db.Set<Customer>().ToDictionaryAsync(c => c.Id, c => c.Name);
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        var projectsQuery = _db.Set<ProjectEntity>().AsQueryable();
        if (allowedIds is not null) projectsQuery = projectsQuery.Where(p => allowedIds.Contains(p.Id));
        var projects = await projectsQuery.OrderBy(p => p.Name).ToListAsync();

        return Ok(projects.Select(p => new ProjectDto(
            p.Id, p.Name,
            customers.TryGetValue(p.CustomerId, out var customerName) ? customerName : "—",
            employees.TryGetValue(p.ProjectManagerId, out var pmName) ? pmName : "—",
            p.Status.ToString(), budgetAccess == FieldAccessLevel.Hidden ? null : p.BudgetAmount)).ToList());
    }

    [HttpPost]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<ActionResult<ProjectDto>> Create(CreateProjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");
        if (request.Name.Trim().Length > 200) return BadRequest("Name can't be longer than 200 characters.");
        if (request.BudgetAmount < 0) return BadRequest("Budget can't be negative.");
        if (request.EndDate is { } end && end < request.StartDate) return BadRequest("End date can't be before the start date.");

        var customer = await _db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == request.CustomerId);
        if (customer is null) return BadRequest("Unknown customer.");

        var projectManager = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == request.ProjectManagerId);
        if (projectManager is null) return BadRequest("Unknown project manager.");

        var project = new ProjectEntity
        {
            Name = request.Name.Trim(),
            CustomerId = request.CustomerId,
            ProjectManagerId = request.ProjectManagerId,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            BudgetAmount = request.BudgetAmount,
        };
        _db.Set<ProjectEntity>().Add(project);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), new ProjectDto(
            project.Id, project.Name, customer.Name,
            $"{projectManager.FirstName} {projectManager.LastName}", project.Status.ToString(), project.BudgetAmount));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<ProjectDetailDto>> Get(Guid id)
    {
        var scopeDecision = await _scope.ResolveAsync(User, Permission.Project.View);
        var allowedIds = await ResolveAllowedProjectIdsAsync(scopeDecision);
        if (allowedIds is not null && !allowedIds.Contains(id)) return Forbid();

        var project = await _db.Set<ProjectEntity>().FirstOrDefaultAsync(p => p.Id == id);
        if (project is null) return NotFound();

        var customer = await _db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == project.CustomerId);
        var pm = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == project.ProjectManagerId);
        var budgetAccess = await _scope.FieldAccessAsync(User, "Project", "BudgetAmount");

        return Ok(new ProjectDetailDto(
            project.Id, project.Name, project.CustomerId, customer?.Name ?? "—",
            project.ProjectManagerId, pm is null ? "—" : $"{pm.FirstName} {pm.LastName}",
            project.Status.ToString(), project.StartDate, project.EndDate,
            budgetAccess == FieldAccessLevel.Hidden ? null : project.BudgetAmount));
    }

    // Covers "Project Planning": the schedule and status are the only things about a
    // project that change after it's created — budget changes go through a real change
    // order in a future module, not a silent edit here.
    [HttpPatch("{id:guid}")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> UpdateSchedule(Guid id, UpdateProjectScheduleRequest request)
    {
        var project = await _db.Set<ProjectEntity>().FirstOrDefaultAsync(p => p.Id == id);
        if (project is null) return NotFound();
        if (request.EndDate is not null && request.EndDate < request.StartDate)
            return BadRequest("End date can't be before the start date.");

        project.StartDate = request.StartDate;
        project.EndDate = request.EndDate;
        project.Status = request.Status;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id:guid}/team")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectMemberDto>>> Team(Guid id)
    {
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
        var members = await _db.Set<ProjectMember>().Where(m => m.ProjectId == id).ToListAsync();

        return Ok(members.Select(m => new ProjectMemberDto(
            m.Id, m.EmployeeId, employees.TryGetValue(m.EmployeeId, out var name) ? name : "—", m.RoleOnProject,
            m.CostRate, m.BillingRate)).ToList());
    }

    [HttpPost("{id:guid}/team")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> AddTeamMember(Guid id, AddProjectMemberRequest request)
    {
        var projectExists = await _db.Set<ProjectEntity>().AnyAsync(p => p.Id == id);
        if (!projectExists) return NotFound();

        var employeeExists = await _db.Set<Employee>().AnyAsync(e => e.Id == request.EmployeeId);
        if (!employeeExists) return BadRequest("Unknown employee.");

        var alreadyMember = await _db.Set<ProjectMember>().AnyAsync(m => m.ProjectId == id && m.EmployeeId == request.EmployeeId);
        if (alreadyMember) return Conflict("This employee is already on the project.");
        if (request.CostRate < 0 || request.BillingRate < 0) return BadRequest("Rates can't be negative.");

        _db.Set<ProjectMember>().Add(new ProjectMember
        {
            ProjectId = id,
            EmployeeId = request.EmployeeId,
            RoleOnProject = request.RoleOnProject,
            CostRate = request.CostRate,
            BillingRate = request.BillingRate,
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Team), new { id }, null);
    }

    [HttpPatch("{id:guid}/team/{memberId:guid}/rates")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> UpdateMemberRates(Guid id, Guid memberId, UpdateProjectMemberRatesRequest request)
    {
        var member = await _db.Set<ProjectMember>().FirstOrDefaultAsync(m => m.Id == memberId && m.ProjectId == id);
        if (member is null) return NotFound();
        if (request.CostRate < 0 || request.BillingRate < 0) return BadRequest("Rates can't be negative.");

        member.CostRate = request.CostRate;
        member.BillingRate = request.BillingRate;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:guid}/team/{memberId:guid}")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> RemoveTeamMember(Guid id, Guid memberId)
    {
        var member = await _db.Set<ProjectMember>().FirstOrDefaultAsync(m => m.Id == memberId && m.ProjectId == id);
        if (member is null) return NotFound();

        _db.Set<ProjectMember>().Remove(member);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Backs "Project Budget": approved spend is money already committed, pending spend is
    // still awaiting sign-off — kept separate so a PM can see how much headroom is left
    // even before every pending claim clears.
    [HttpGet("{id:guid}/budget")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<ProjectBudgetDto>> Budget(Guid id)
    {
        var scopeDecision = await _scope.ResolveAsync(User, Permission.Project.View);
        var allowedIds = await ResolveAllowedProjectIdsAsync(scopeDecision);
        if (allowedIds is not null && !allowedIds.Contains(id)) return Forbid();

        var project = await _db.Set<ProjectEntity>().FirstOrDefaultAsync(p => p.Id == id);
        if (project is null) return NotFound();

        var expenses = await _db.Set<ProjectExpense>().Where(e => e.ProjectId == id).ToListAsync();
        var approved = expenses.Where(e => e.Status == ProjectExpenseStatus.Approved).Sum(e => e.Amount);
        var pending = expenses.Where(e => e.Status is ProjectExpenseStatus.Pending or ProjectExpenseStatus.ManagerApproved).Sum(e => e.Amount);
        var remaining = project.BudgetAmount - approved - pending;
        var percentSpent = project.BudgetAmount == 0 ? 0 : Math.Round((approved + pending) / project.BudgetAmount * 100, 1);

        return Ok(new ProjectBudgetDto(project.BudgetAmount, approved, pending, remaining, percentSpent));
    }

    // Backs "Project Profitability": labor cost/revenue comes from approved timesheet hours
    // priced at each member's per-project rates; expense cost/revenue comes from approved
    // project expenses (billable ones also count as revenue, pass-through, no markup).
    [HttpGet("{id:guid}/financials")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<ProjectFinancialsDto>> Financials(Guid id)
    {
        var projectExists = await _db.Set<ProjectEntity>().AnyAsync(p => p.Id == id);
        if (!projectExists) return NotFound();

        var rates = await _db.Set<ProjectMember>().Where(m => m.ProjectId == id)
            .ToDictionaryAsync(m => m.EmployeeId, m => (m.CostRate, m.BillingRate));

        var hours = await _db.Set<TimesheetEntry>()
            .Where(t => t.ProjectId == id && t.Status == TimesheetStatus.Approved)
            .ToListAsync();

        var expenses = await _db.Set<ProjectExpense>()
            .Where(e => e.ProjectId == id && e.Status == ProjectExpenseStatus.Approved)
            .ToListAsync();

        decimal laborCost = 0, laborRevenue = 0;
        var monthlyRevenue = new SortedDictionary<string, decimal>();
        var monthlyCost = new SortedDictionary<string, decimal>();

        foreach (var h in hours)
        {
            var (costRate, billingRate) = rates.TryGetValue(h.EmployeeId, out var r) ? r : (0m, 0m);
            var cost = h.Hours * costRate;
            var revenue = h.IsBillable ? h.Hours * billingRate : 0;
            laborCost += cost;
            laborRevenue += revenue;

            var key = h.WorkDate.ToString("yyyy-MM");
            monthlyRevenue[key] = monthlyRevenue.GetValueOrDefault(key) + revenue;
            monthlyCost[key] = monthlyCost.GetValueOrDefault(key) + cost;
        }

        decimal expenseCost = 0, expenseRevenue = 0;
        foreach (var e in expenses)
        {
            expenseCost += e.Amount;
            var revenue = e.IsBillable ? e.Amount : 0;
            expenseRevenue += revenue;

            var key = e.IncurredOn.ToString("yyyy-MM");
            monthlyRevenue[key] = monthlyRevenue.GetValueOrDefault(key) + revenue;
            monthlyCost[key] = monthlyCost.GetValueOrDefault(key) + e.Amount;
        }

        var totalCost = laborCost + expenseCost;
        var totalRevenue = laborRevenue + expenseRevenue;
        var profit = totalRevenue - totalCost;
        var marginPercent = totalRevenue == 0 ? 0 : Math.Round(profit / totalRevenue * 100, 1);

        var months = monthlyRevenue.Keys.Union(monthlyCost.Keys).OrderBy(k => k);
        var monthly = months.Select(k => new ProjectFinancialsMonthDto(
            k, monthlyRevenue.GetValueOrDefault(k), monthlyCost.GetValueOrDefault(k))).ToList();

        return Ok(new ProjectFinancialsDto(
            laborCost, laborRevenue, expenseCost, expenseRevenue,
            totalCost, totalRevenue, profit, marginPercent, monthly));
    }

    [HttpGet("{id:guid}/milestones")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectMilestoneDto>>> Milestones(Guid id)
    {
        var milestones = await _db.Set<ProjectMilestone>()
            .Where(m => m.ProjectId == id)
            .OrderBy(m => m.DueDate)
            .ToListAsync();

        return Ok(milestones.Select(m => new ProjectMilestoneDto(m.Id, m.ProjectId, m.Name, m.DueDate, m.Status.ToString())).ToList());
    }

    [HttpPost("{id:guid}/milestones")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> AddMilestone(Guid id, CreateProjectMilestoneRequest request)
    {
        var projectExists = await _db.Set<ProjectEntity>().AnyAsync(p => p.Id == id);
        if (!projectExists) return NotFound();
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");

        _db.Set<ProjectMilestone>().Add(new ProjectMilestone
        {
            ProjectId = id,
            Name = request.Name.Trim(),
            DueDate = request.DueDate,
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Milestones), new { id }, null);
    }

    [HttpPatch("{id:guid}/milestones/{milestoneId:guid}")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> UpdateMilestone(Guid id, Guid milestoneId, UpdateProjectMilestoneRequest request)
    {
        var milestone = await _db.Set<ProjectMilestone>().FirstOrDefaultAsync(m => m.Id == milestoneId && m.ProjectId == id);
        if (milestone is null) return NotFound();
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");

        milestone.Name = request.Name.Trim();
        milestone.DueDate = request.DueDate;
        milestone.Status = request.Status;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:guid}/milestones/{milestoneId:guid}")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> DeleteMilestone(Guid id, Guid milestoneId)
    {
        var milestone = await _db.Set<ProjectMilestone>().FirstOrDefaultAsync(m => m.Id == milestoneId && m.ProjectId == id);
        if (milestone is null) return NotFound();

        _db.Set<ProjectMilestone>().Remove(milestone);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Itemized cost for "Project Cost" — every expense against this project, any status,
    // unlike Budget above which only ever shows totals.
    [HttpGet("{id:guid}/expenses")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectExpenseDto>>> Expenses(Guid id)
    {
        var expenses = await _db.Set<ProjectExpense>().Where(e => e.ProjectId == id).OrderByDescending(e => e.IncurredOn).ToListAsync();
        var project = await _db.Set<ProjectEntity>().FirstOrDefaultAsync(p => p.Id == id);
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return Ok(expenses.Select(e => new ProjectExpenseDto(
            e.Id, project?.Name ?? "—", employees.TryGetValue(e.EmployeeId, out var name) ? name : "—",
            e.Amount, e.Category, e.Description, e.IncurredOn, e.IsBillable, e.Status.ToString(), e.JournalEntryId)).ToList());
    }

    // Every task assigned to the caller, across every project — nothing else in the app
    // surfaces this, so without it a task a manager assigns is invisible to the person
    // holding it unless they already know which project to go dig through.
    [HttpGet("my-tasks")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectTaskDto>>> MyTasks()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<ProjectTaskDto>());

        var tasks = await _db.Set<ProjectTask>()
            .Where(t => t.AssignedToEmployeeId == employeeId)
            .OrderBy(t => t.DueDate)
            .ToListAsync();
        var projectNames = await _db.Set<ProjectEntity>().ToDictionaryAsync(p => p.Id, p => p.Name);

        return Ok(tasks.Select(t => new ProjectTaskDto(
            t.Id, t.ProjectId, t.Title, t.Description,
            t.AssignedToEmployeeId, null,
            t.Status.ToString(), t.DueDate,
            projectNames.GetValueOrDefault(t.ProjectId, "—"))).ToList());
    }

    // The task's own assignee can move it ToDo -> InProgress -> Done without needing the
    // project-management permission that reassigning or re-dating a task requires.
    [HttpPatch("{id:guid}/tasks/{taskId:guid}/status")]
    [RequirePermission(Permission.Project.View)]
    public async Task<IActionResult> UpdateOwnTaskStatus(Guid id, Guid taskId, UpdateTaskStatusRequest request)
    {
        var task = await _db.Set<ProjectTask>().FirstOrDefaultAsync(t => t.Id == taskId && t.ProjectId == id);
        if (task is null) return NotFound();
        if (task.AssignedToEmployeeId != CurrentEmployeeId) return Forbid();

        task.Status = request.Status;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id:guid}/tasks")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectTaskDto>>> Tasks(Guid id)
    {
        var tasks = await _db.Set<ProjectTask>().Where(t => t.ProjectId == id).OrderBy(t => t.DueDate).ToListAsync();
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return Ok(tasks.Select(t => new ProjectTaskDto(
            t.Id, t.ProjectId, t.Title, t.Description,
            t.AssignedToEmployeeId,
            t.AssignedToEmployeeId is { } aid && employees.TryGetValue(aid, out var name) ? name : null,
            t.Status.ToString(), t.DueDate)).ToList());
    }

    [HttpPost("{id:guid}/tasks")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> AddTask(Guid id, CreateProjectTaskRequest request)
    {
        var projectExists = await _db.Set<ProjectEntity>().AnyAsync(p => p.Id == id);
        if (!projectExists) return NotFound();
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest("Title is required.");

        _db.Set<ProjectTask>().Add(new ProjectTask
        {
            ProjectId = id,
            Title = request.Title.Trim(),
            Description = request.Description,
            AssignedToEmployeeId = request.AssignedToEmployeeId,
            DueDate = request.DueDate,
        });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Tasks), new { id }, null);
    }

    [HttpPatch("{id:guid}/tasks/{taskId:guid}")]
    [RequirePermission(Permission.Project.ManageBudget)]
    public async Task<IActionResult> UpdateTask(Guid id, Guid taskId, UpdateProjectTaskRequest request)
    {
        var task = await _db.Set<ProjectTask>().FirstOrDefaultAsync(t => t.Id == taskId && t.ProjectId == id);
        if (task is null) return NotFound();

        task.Status = request.Status;
        task.AssignedToEmployeeId = request.AssignedToEmployeeId;
        task.DueDate = request.DueDate;
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.Identity.Authorization;
using Nexora.Modules.Reporting.Contracts;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Shared.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Reporting.Controllers;

// Read-only roll-ups over data that already exists in Leave/Attendance/Project/Reimbursement —
// nothing here is a new source of truth, just a manager-facing view across their own scope
// (direct reports, projects they manage) rather than a single employee or project at a time.
// Each action keeps its original [RequirePermission] gate (the flat "can call this endpoint at
// all" check) and additionally consults IReportAccessService — the admin-configurable "which
// specific roles/users/projects" layer on top. RoleTemplates gives every system role a matching
// Permission.Reports.* default, so this addition doesn't remove anyone's access on its own.
[ApiController]
[Authorize]
[Route("api/reports")]
[RequireModule(ModuleCatalog.Reports)]
public class ReportsController : ControllerBase
{
    private readonly DbContext _db;
    private readonly IReportAccessService _reportAccess;
    public ReportsController(DbContext db, IReportAccessService reportAccess)
    {
        _db = db;
        _reportAccess = reportAccess;
    }

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    [HttpGet("team")]
    [RequirePermission(Permission.Leave.ApproveAsManager)]
    public async Task<ActionResult<List<TeamReportRowDto>>> Team()
    {
        if (!await _reportAccess.CanAccessAsync(User, Permission.Reports.ViewTeam)) return Forbid();
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<TeamReportRowDto>());

        var reports = await _db.Set<Employee>().Where(e => e.ReportingManagerId == managerId).ToListAsync();
        var reportIds = reports.Select(e => e.Id).ToList();

        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;

        var pendingLeaveByEmployee = await _db.Set<LeaveRequest>()
            .Where(r => reportIds.Contains(r.EmployeeId) && r.Status == LeaveRequestStatus.PendingManagerApproval)
            .GroupBy(r => r.EmployeeId)
            .Select(g => new { EmployeeId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);

        var leaveDaysByEmployee = await _db.Set<LeaveRequest>()
            .Where(r => reportIds.Contains(r.EmployeeId) && r.Status == LeaveRequestStatus.Approved && r.StartDate.Year == year)
            .GroupBy(r => r.EmployeeId)
            .Select(g => new { EmployeeId = g.Key, Days = g.Sum(r => r.DaysRequested) })
            .ToDictionaryAsync(x => x.EmployeeId, x => x.Days);

        var attendanceDaysByEmployee = await _db.Set<AttendanceEntry>()
            .Where(a => reportIds.Contains(a.EmployeeId) && a.WorkDate.Year == year && a.WorkDate.Month == month)
            .GroupBy(a => a.EmployeeId)
            .Select(g => new { EmployeeId = g.Key, Days = g.Count() })
            .ToDictionaryAsync(x => x.EmployeeId, x => x.Days);

        var jobTitles = await _db.Set<JobTitle>().ToDictionaryAsync(j => j.Id, j => j.Name);

        return Ok(reports.Select(e => new TeamReportRowDto(
            e.Id, $"{e.FirstName} {e.LastName}", jobTitles.GetValueOrDefault(e.JobTitleId, "—"),
            pendingLeaveByEmployee.GetValueOrDefault(e.Id),
            leaveDaysByEmployee.GetValueOrDefault(e.Id),
            attendanceDaysByEmployee.GetValueOrDefault(e.Id))).ToList());
    }

    [HttpGet("projects")]
    [RequirePermission(Permission.Project.View)]
    public async Task<ActionResult<List<ProjectReportRowDto>>> Projects()
    {
        var access = await _reportAccess.ResolveAsync(User, Permission.Reports.ViewProjects);
        if (!access.Allowed) return Forbid();
        if (CurrentEmployeeId is not { } pmId) return Ok(new List<ProjectReportRowDto>());

        // Intersect (not replace) the existing ProjectManagerId ownership filter with any
        // project-scoped grants an Admin configured — see IReportAccessService's doc comment
        // for why a role-/user-wide grant (access.ProjectIds == null) never narrows.
        var projectsQuery = _db.Set<ProjectEntity>().Where(p => p.ProjectManagerId == pmId);
        if (access.ProjectIds is not null)
        {
            projectsQuery = projectsQuery.Where(p => access.ProjectIds.Contains(p.Id));
        }
        var projects = await projectsQuery.ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();
        var expenses = await _db.Set<ProjectExpense>().Where(e => projectIds.Contains(e.ProjectId)).ToListAsync();

        return Ok(projects.Select(p =>
        {
            var projectExpenses = expenses.Where(e => e.ProjectId == p.Id).ToList();
            var approved = projectExpenses.Where(e => e.Status == ProjectExpenseStatus.Approved).Sum(e => e.Amount);
            var pending = projectExpenses.Where(e => e.Status is ProjectExpenseStatus.Pending or ProjectExpenseStatus.ManagerApproved).Sum(e => e.Amount);
            var percentSpent = p.BudgetAmount == 0 ? 0 : Math.Round((approved + pending) / p.BudgetAmount * 100, 1);

            return new ProjectReportRowDto(p.Id, p.Name, p.Status.ToString(), p.BudgetAmount, approved, pending, percentSpent);
        }).ToList());
    }

    [HttpGet("expenses")]
    [RequirePermission(Permission.Expense.ApproveAsManager)]
    public async Task<ActionResult<List<ExpenseReportRowDto>>> Expenses()
    {
        if (!await _reportAccess.CanAccessAsync(User, Permission.Reports.ViewExpenses)) return Forbid();
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<ExpenseReportRowDto>());

        var reportIds = await _db.Set<Employee>()
            .Where(e => e.ReportingManagerId == managerId)
            .Select(e => e.Id)
            .ToListAsync();
        var managedProjectIds = await _db.Set<ProjectEntity>()
            .Where(p => p.ProjectManagerId == managerId)
            .Select(p => p.Id)
            .ToListAsync();

        var reimbursements = await _db.Set<ReimbursementRequest>()
            .Where(r => reportIds.Contains(r.EmployeeId) && r.Status != ReimbursementStatus.Rejected)
            .ToListAsync();
        var projectExpenses = await _db.Set<ProjectExpense>()
            .Where(e => managedProjectIds.Contains(e.ProjectId) && e.Status != ProjectExpenseStatus.Rejected)
            .ToListAsync();

        var categories = reimbursements.Select(r => r.Category)
            .Concat(projectExpenses.Select(e => e.Category))
            .Distinct();

        return Ok(categories.Select(category => new ExpenseReportRowDto(
            category,
            reimbursements.Where(r => r.Category == category).Sum(r => r.Amount),
            projectExpenses.Where(e => e.Category == category).Sum(e => e.Amount),
            reimbursements.Count(r => r.Category == category) + projectExpenses.Count(e => e.Category == category)
        )).ToList());
    }

    // Finance's version of the report above — tenant-wide rather than scoped to a
    // manager's own reports/projects, since Finance isn't anyone's reporting line.
    [HttpGet("expenses-all")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<ExpenseReportRowDto>>> ExpensesAll()
    {
        if (!await _reportAccess.CanAccessAsync(User, Permission.Reports.ViewFinance)) return Forbid();

        var reimbursements = await _db.Set<ReimbursementRequest>().Where(r => r.Status != ReimbursementStatus.Rejected).ToListAsync();
        var projectExpenses = await _db.Set<ProjectExpense>().Where(e => e.Status != ProjectExpenseStatus.Rejected).ToListAsync();

        var categories = reimbursements.Select(r => r.Category)
            .Concat(projectExpenses.Select(e => e.Category))
            .Distinct();

        return Ok(categories.Select(category => new ExpenseReportRowDto(
            category,
            reimbursements.Where(r => r.Category == category).Sum(r => r.Amount),
            projectExpenses.Where(e => e.Category == category).Sum(e => e.Amount),
            reimbursements.Count(r => r.Category == category) + projectExpenses.Count(e => e.Category == category)
        )).ToList());
    }
}

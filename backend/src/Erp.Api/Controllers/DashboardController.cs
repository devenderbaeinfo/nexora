using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Identity;
using Erp.Domain.People;
using Erp.Domain.Project;
using Erp.Domain.Timecard;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// Everything here is scoped to the caller's own employee_id — no permission gate, because
// the numbers are naturally zero for anyone without direct reports or managed projects.
// A plain Employee gets an empty dashboard rather than a 403; a Manager gets a real one.
[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly ErpDbContext _db;
    public DashboardController(ErpDbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary()
    {
        if (CurrentEmployeeId is not { } employeeId)
            return Ok(new DashboardSummaryDto(0, 0, 0, 0, 0, 0, 0));

        var directReportIds = await _db.Employees
            .Where(e => e.ReportingManagerId == employeeId)
            .Select(e => e.Id)
            .ToListAsync();

        var pendingLeave = await _db.LeaveRequests
            .Where(r => directReportIds.Contains(r.EmployeeId) && r.Status == LeaveRequestStatus.PendingManagerApproval)
            .CountAsync();

        var pendingExpense = await _db.ReimbursementRequests
            .Where(r => directReportIds.Contains(r.EmployeeId) && r.Status == Erp.Domain.Reimbursement.ReimbursementStatus.Pending)
            .CountAsync();

        var managedProjectIds = await _db.Projects
            .Where(p => p.ProjectManagerId == employeeId)
            .Select(p => p.Id)
            .ToListAsync();

        var pendingProjectExpense = await _db.ProjectExpenses
            .Where(e => managedProjectIds.Contains(e.ProjectId) && e.Status == ProjectExpenseStatus.Pending)
            .CountAsync();

        var managedProjects = await _db.Projects.Where(p => managedProjectIds.Contains(p.Id)).ToListAsync();
        var managedProjectExpenses = await _db.ProjectExpenses
            .Where(e => managedProjectIds.Contains(e.ProjectId) && e.Status == ProjectExpenseStatus.Approved)
            .ToListAsync();

        return Ok(new DashboardSummaryDto(
            directReportIds.Count,
            pendingLeave,
            pendingExpense,
            pendingProjectExpense,
            managedProjects.Count,
            managedProjects.Sum(p => p.BudgetAmount),
            managedProjectExpenses.Sum(e => e.Amount)));
    }

    // Headcount over the last 6 months and a same-day attendance rate over the last 14 —
    // the two trends that make an HR/Admin landing page more useful than a list of links.
    [HttpGet("hr-trends")]
    [RequirePermission(Permission.Attendance.ViewAll)]
    public async Task<ActionResult<HrTrendsDto>> HrTrends()
    {
        var employees = await _db.Employees.Select(e => new { e.Id, e.HireDate, e.TerminationDate, e.Status }).ToListAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var firstOfThisMonth = new DateOnly(today.Year, today.Month, 1);

        var headcount = Enumerable.Range(0, 6)
            .Select(i => firstOfThisMonth.AddMonths(-(5 - i)))
            .Select(monthStart =>
            {
                var monthEnd = monthStart.AddMonths(1).AddDays(-1);
                var count = employees.Count(e => e.HireDate <= monthEnd && (e.TerminationDate == null || e.TerminationDate > monthEnd));
                return new HeadcountPointDto(monthStart.ToString("MMM yyyy"), count);
            })
            .ToList();

        var activeEmployeeIds = employees.Where(e => e.Status == EmploymentStatus.Active).Select(e => e.Id).ToHashSet();
        var windowStart = today.AddDays(-13);
        var entries = await _db.AttendanceEntries
            .Where(a => a.WorkDate >= windowStart && a.WorkDate <= today)
            .Select(a => new { a.WorkDate, a.EmployeeId })
            .ToListAsync();

        var attendance = new List<AttendancePointDto>();
        for (var day = windowStart; day <= today; day = day.AddDays(1))
        {
            var present = entries.Where(a => a.WorkDate == day && activeEmployeeIds.Contains(a.EmployeeId)).Select(a => a.EmployeeId).Distinct().Count();
            attendance.Add(new AttendancePointDto(day.ToString("MMM d"), present, activeEmployeeIds.Count));
        }

        return Ok(new HrTrendsDto(headcount, attendance));
    }
}

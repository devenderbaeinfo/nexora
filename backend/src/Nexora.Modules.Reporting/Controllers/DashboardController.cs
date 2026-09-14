using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.Reporting.Contracts;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Reporting.Controllers;

// Everything here is scoped to the caller's own employee_id — no permission gate, because
// the numbers are naturally zero for anyone without direct reports or managed projects.
// A plain Employee gets an empty dashboard rather than a 403; a Manager gets a real one.
[ApiController]
[Authorize]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly NexoraDbContext _db;
    public DashboardController(NexoraDbContext db) => _db = db;

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

    private bool Can(string permission) => User.Claims.Any(c => c.Type == "perm" && c.Value == permission);

    // Org-wide KPI row for the dashboard landing page. Every field is nullable and populated
    // only if the caller holds the specific permission it depends on — one HR admin might see
    // headcount + leave but not expenses, another sees expenses but not payroll, etc. This is
    // deliberately one endpoint rather than four: the alternative is four separate round trips
    // for what's rendered as a single row of cards.
    [HttpGet("kpis")]
    public async Task<ActionResult<DashboardKpisDto>> Kpis()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var prevMonthStart = monthStart.AddMonths(-1);
        var prevMonthEnd = monthStart.AddDays(-1);

        int? totalEmployees = null;
        double? employeesDelta = null;
        if (Can(Permission.People.View))
        {
            var employees = await _db.Employees.Select(e => new { e.HireDate, e.TerminationDate }).ToListAsync();
            totalEmployees = employees.Count(e => e.HireDate <= today && (e.TerminationDate == null || e.TerminationDate > today));
            var lastMonthCount = employees.Count(e => e.HireDate <= prevMonthEnd && (e.TerminationDate == null || e.TerminationDate > prevMonthEnd));
            employeesDelta = lastMonthCount == 0 ? null : Math.Round((totalEmployees.Value - lastMonthCount) / (double)lastMonthCount * 100, 1);
        }

        int? onLeaveToday = null;
        List<UpcomingLeaveDto>? upcomingLeaves = null;
        if (Can(Permission.Attendance.ViewAll) || Can(Permission.Leave.ApproveAsHr))
        {
            onLeaveToday = await _db.LeaveRequests
                .Where(r => r.Status == LeaveRequestStatus.Approved && r.StartDate <= today && r.EndDate >= today)
                .Select(r => r.EmployeeId).Distinct().CountAsync();

            var upcomingRows = await _db.LeaveRequests
                .Where(r => r.Status == LeaveRequestStatus.Approved && r.StartDate > today)
                .OrderBy(r => r.StartDate)
                .Take(10)
                .Select(r => new { r.EmployeeId, r.StartDate, r.EndDate, r.DaysRequested })
                .ToListAsync();
            var employeeIds = upcomingRows.Select(r => r.EmployeeId).ToHashSet();
            var names = await _db.Employees
                .Where(e => employeeIds.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
            upcomingLeaves = upcomingRows
                .Select(r => new UpcomingLeaveDto(names.GetValueOrDefault(r.EmployeeId, "Unknown"), r.StartDate, r.EndDate, r.DaysRequested))
                .ToList();
        }

        decimal? expensesMtd = null;
        double? expensesDelta = null;
        List<ExpenseCategoryDto>? expenseByCategory = null;
        if (Can(Permission.Accounting.View) || Can(Permission.Expense.ApproveAsFinance))
        {
            var reimbursements = await _db.ReimbursementRequests
                .Where(r => r.Status == ReimbursementStatus.Approved && r.IncurredOn >= prevMonthStart)
                .Select(r => new { r.Amount, r.Category, r.IncurredOn })
                .ToListAsync();
            var projectExpenses = await _db.ProjectExpenses
                .Where(e => e.Status == ProjectExpenseStatus.Approved && e.IncurredOn >= prevMonthStart)
                .Select(e => new { e.Amount, e.Category, e.IncurredOn })
                .ToListAsync();
            var combined = reimbursements.Select(r => (r.Amount, r.Category, r.IncurredOn))
                .Concat(projectExpenses.Select(e => (e.Amount, e.Category, e.IncurredOn)))
                .ToList();

            var thisMonth = combined.Where(x => x.IncurredOn >= monthStart).ToList();
            var lastMonth = combined.Where(x => x.IncurredOn <= prevMonthEnd).ToList();

            expensesMtd = thisMonth.Sum(x => x.Amount);
            var lastMonthTotal = lastMonth.Sum(x => x.Amount);
            expensesDelta = lastMonthTotal == 0 ? null : (double)Math.Round((expensesMtd.Value - lastMonthTotal) / lastMonthTotal * 100, 1);

            expenseByCategory = thisMonth
                .GroupBy(x => string.IsNullOrWhiteSpace(x.Category) ? "Other" : x.Category)
                .Select(g => new ExpenseCategoryDto(g.Key, g.Sum(x => x.Amount)))
                .OrderByDescending(c => c.Amount)
                .ToList();
        }

        // Not "Total Revenue" — this product has no invoicing/billing module yet, so a Revenue
        // KPI would legitimately show ₹0 for every tenant today (nothing ever posts to a
        // Revenue account except a manual journal entry). Payroll cost is the equivalent
        // "big number" this ERP actually has real data for.
        decimal? payrollCostMtd = null;
        double? payrollCostDelta = null;
        if (Can(Permission.Payroll.View) || Can(Permission.Payroll.Manage) || Can(Permission.Payroll.Approve))
        {
            var currentRun = await _db.PayrollRuns.FirstOrDefaultAsync(r => r.PeriodMonth == today.Month && r.PeriodYear == today.Year);
            payrollCostMtd = currentRun is null
                ? 0
                : await _db.Payslips.Where(p => p.PayrollRunId == currentRun.Id).SumAsync(p => (decimal?)p.NetPay) ?? 0;

            var prevRun = await _db.PayrollRuns.FirstOrDefaultAsync(r => r.PeriodMonth == prevMonthStart.Month && r.PeriodYear == prevMonthStart.Year);
            var prevPayrollCost = prevRun is null
                ? 0m
                : await _db.Payslips.Where(p => p.PayrollRunId == prevRun.Id).SumAsync(p => (decimal?)p.NetPay) ?? 0;
            payrollCostDelta = prevPayrollCost == 0 ? null : (double)Math.Round((payrollCostMtd.Value - prevPayrollCost) / prevPayrollCost * 100, 1);
        }

        string? baseCurrency = (expensesMtd != null || payrollCostMtd != null)
            ? await _db.Tenants.Select(t => t.BaseCurrencyCode).FirstOrDefaultAsync()
            : null;

        return Ok(new DashboardKpisDto(
            totalEmployees, employeesDelta,
            onLeaveToday,
            expensesMtd, expensesDelta, expenseByCategory,
            payrollCostMtd, payrollCostDelta,
            upcomingLeaves,
            baseCurrency));
    }
}

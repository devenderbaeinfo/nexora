using System.Security.Claims;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Payroll.Entities;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.HR.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Notifications.Controllers;

// RequiresAction distinguishes "waiting on you to act" (a pending-approval queue) from
// "FYI, here's what happened to your own request" — the Action Center groups and counts
// only the former; the latter stays a flat recent-activity feed.
public record NotificationItem(string Kind, string Label, Guid Id, DateTimeOffset CreatedAtUtc, string LinkPath, bool RequiresAction);

// An aggregation point over two kinds of things worth a bell icon: the "pending approval"
// queues that already exist per module (Leave, Timesheet, Reimbursement, Project Expense),
// and — separately — the caller's own submissions that were just decided on. Nothing new is
// tracked here (no notification table, no read/unread state); this just asks each queue and
// each of the caller's own request tables "anything relevant lately?" on every poll.
[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly DbContext _db;
    public NotificationsController(DbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private bool Has(string perm) => User.HasClaim("perm", perm);

    [HttpGet("pending-approvals")]
    public async Task<ActionResult<List<NotificationItem>>> PendingApprovals()
    {
        var items = new List<NotificationItem>();
        var employeeId = CurrentEmployeeId;

        if (Has(Permission.Leave.ApproveAsManager) && employeeId is { } mgrId)
        {
            var directReportIds = await _db.Set<Employee>().Where(e => e.ReportingManagerId == mgrId).Select(e => e.Id).ToListAsync();
            var rows = await _db.Set<LeaveRequest>()
                .Where(r => directReportIds.Contains(r.EmployeeId) && r.Status == LeaveRequestStatus.PendingManagerApproval)
                .Select(r => new { r.Id, r.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(r => new NotificationItem("Leave", "Leave request awaiting your approval", r.Id, r.CreatedAtUtc, "/timecard", true)));
        }

        if (Has(Permission.Leave.ApproveAsHr))
        {
            var rows = await _db.Set<LeaveRequest>()
                .Where(r => r.Status == LeaveRequestStatus.PendingHrApproval)
                .Select(r => new { r.Id, r.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(r => new NotificationItem("Leave", "Leave request awaiting HR approval", r.Id, r.CreatedAtUtc, "/timecard", true)));
        }

        if (Has(Permission.Timesheet.Approve) && employeeId is { } tsMgrId)
        {
            var directReportIds = await _db.Set<Employee>().Where(e => e.ReportingManagerId == tsMgrId).Select(e => e.Id).ToListAsync();
            var rows = await _db.Set<TimesheetEntry>()
                .Where(t => directReportIds.Contains(t.EmployeeId) && t.Status == TimesheetStatus.Submitted)
                .Select(t => new { t.Id, t.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(t => new NotificationItem("Timesheet", "Timesheet entry awaiting your approval", t.Id, t.CreatedAtUtc, "/timesheets/approval", true)));
        }

        if (Has(Permission.Expense.ApproveAsManager) && employeeId is { } expMgrId)
        {
            var directReportIds = await _db.Set<Employee>().Where(e => e.ReportingManagerId == expMgrId).Select(e => e.Id).ToListAsync();
            var rows = await _db.Set<ReimbursementRequest>()
                .Where(r => directReportIds.Contains(r.EmployeeId) && r.Status == ReimbursementStatus.Pending)
                .Select(r => new { r.Id, r.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(r => new NotificationItem("Expense", "Reimbursement awaiting your approval", r.Id, r.CreatedAtUtc, "/expenses/approvals", true)));
        }

        if (Has(Permission.Expense.ApproveAsFinance))
        {
            var rows = await _db.Set<ReimbursementRequest>()
                .Where(r => r.Status == ReimbursementStatus.ManagerApproved)
                .Select(r => new { r.Id, r.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(r => new NotificationItem("Expense", "Reimbursement awaiting Finance approval", r.Id, r.CreatedAtUtc, "/expenses/approvals", true)));
        }

        if (Has(Permission.Project.ApproveExpenseAsProjectManager) && employeeId is { } pmId)
        {
            var myProjectIds = await _db.Set<ProjectEntity>().Where(p => p.ProjectManagerId == pmId).Select(p => p.Id).ToListAsync();
            var rows = await _db.Set<ProjectExpense>()
                .Where(e => myProjectIds.Contains(e.ProjectId) && e.Status == ProjectExpenseStatus.Pending)
                .Select(e => new { e.Id, e.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(e => new NotificationItem("Project expense", "Project expense awaiting your approval", e.Id, e.CreatedAtUtc, "/expenses/approvals", true)));
        }

        if (Has(Permission.Project.ApproveExpenseAsFinance))
        {
            var rows = await _db.Set<ProjectExpense>()
                .Where(e => e.Status == ProjectExpenseStatus.ManagerApproved)
                .Select(e => new { e.Id, e.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(rows.Select(e => new NotificationItem("Project expense", "Project expense awaiting Finance approval", e.Id, e.CreatedAtUtc, "/projects/expenses", true)));
        }

        if (Has(Permission.Payroll.Approve))
        {
            var draftRuns = await _db.Set<PayrollRun>()
                .Where(r => r.Status == PayrollRunStatus.Draft)
                .Select(r => new { r.Id, r.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(draftRuns.Select(r => new NotificationItem("Payroll", "Payroll run awaiting your approval", r.Id, r.CreatedAtUtc, $"/payroll/runs/{r.Id}", true)));

            var approvedRuns = await _db.Set<PayrollRun>()
                .Where(r => r.Status == PayrollRunStatus.Approved)
                .Select(r => new { r.Id, ApprovedAtUtc = r.ApprovedAtUtc ?? r.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(approvedRuns.Select(r => new NotificationItem("Payroll", "Payroll run awaiting disbursement", r.Id, r.ApprovedAtUtc, $"/payroll/runs/{r.Id}", true)));
        }

        // The other half: telling someone what happened to THEIR OWN request, not just
        // what's waiting on someone else. No "seen" flag exists, so this is windowed to the
        // last 14 days rather than growing forever — old decisions age out of the bell on
        // their own instead of needing an explicit dismiss action.
        var since = DateTimeOffset.UtcNow.AddDays(-14);
        if (employeeId is { } selfId)
        {
            var myLeave = await _db.Set<LeaveRequest>()
                .Where(r => r.EmployeeId == selfId
                    && (r.Status == LeaveRequestStatus.Approved || r.Status == LeaveRequestStatus.RejectedByManager || r.Status == LeaveRequestStatus.RejectedByHr)
                    && (r.HrActedAtUtc ?? r.ManagerActedAtUtc) >= since)
                .Select(r => new { r.Id, DecidedAt = (r.HrActedAtUtc ?? r.ManagerActedAtUtc)!.Value, r.Status })
                .ToListAsync();
            items.AddRange(myLeave.Select(r => new NotificationItem(
                "Leave", $"Your leave request was {DecisionLabel(r.Status.ToString())}", r.Id, r.DecidedAt, "/timecard", false)));

            var myReimbursements = await _db.Set<ReimbursementRequest>()
                .Where(r => r.EmployeeId == selfId
                    && (r.Status == ReimbursementStatus.Approved || r.Status == ReimbursementStatus.Rejected)
                    && r.UpdatedAtUtc >= since)
                .Select(r => new { r.Id, DecidedAt = r.UpdatedAtUtc!.Value, r.Status })
                .ToListAsync();
            items.AddRange(myReimbursements.Select(r => new NotificationItem(
                "Expense", $"Your reimbursement was {DecisionLabel(r.Status.ToString())}", r.Id, r.DecidedAt, "/reimbursement", false)));

            var myProjectExpenses = await _db.Set<ProjectExpense>()
                .Where(e => e.EmployeeId == selfId
                    && (e.Status == ProjectExpenseStatus.Approved || e.Status == ProjectExpenseStatus.Rejected)
                    && e.UpdatedAtUtc >= since)
                .Select(e => new { e.Id, DecidedAt = e.UpdatedAtUtc!.Value, e.Status })
                .ToListAsync();
            items.AddRange(myProjectExpenses.Select(e => new NotificationItem(
                "Project expense", $"Your project expense was {DecisionLabel(e.Status.ToString())}", e.Id, e.DecidedAt, "/projects/expenses", false)));

            // PRJ-8: a task getting assigned to you isn't an approval queue, just something
            // worth surfacing — same "recent, no read state" treatment as the FYI items above.
            var myTasks = await _db.Set<ProjectTask>()
                .Where(t => t.AssignedToEmployeeId == selfId && (t.UpdatedAtUtc ?? t.CreatedAtUtc) >= since)
                .Select(t => new { t.Id, t.Title, AssignedAt = t.UpdatedAtUtc ?? t.CreatedAtUtc })
                .ToListAsync();
            items.AddRange(myTasks.Select(t => new NotificationItem(
                "Task", $"Assigned to you: {t.Title}", t.Id, t.AssignedAt, "/projects/team", false)));
        }

        return Ok(items.OrderByDescending(i => i.CreatedAtUtc).ToList());
    }

    private static string DecisionLabel(string status) => status switch
    {
        "Approved" => "approved",
        "Rejected" or "RejectedByManager" or "RejectedByHr" => "rejected",
        _ => status.ToLowerInvariant(),
    };
}

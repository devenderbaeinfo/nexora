using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.HR.Contracts;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Modules.Workflow.Entities;
using Nexora.Modules.Workflow.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.HR.Controllers;

[ApiController]
[Authorize]
[Route("api/leave-requests")]
public class LeaveRequestsController : ControllerBase
{
    private readonly DbContext _db;
    private readonly IApprovalWorkflowService _workflow;

    public LeaveRequestsController(DbContext db, IApprovalWorkflowService workflow)
    {
        _db = db;
        _workflow = workflow;
    }

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    // The Admin-configured catch-all approver for employees with no ReportingManagerId
    // (see ApprovalSettingsController / PPL-10) — null when nothing's been configured.
    private async Task<Guid?> FallbackApproverIdAsync() =>
        (await _db.Set<TenantApprovalSettings>().FirstOrDefaultAsync())?.FallbackApproverEmployeeId;

    [HttpGet("mine")]
    [RequirePermission(Permission.Leave.View)]
    public async Task<ActionResult<List<LeaveRequestDto>>> Mine()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<LeaveRequestDto>());
        return Ok(await BuildDtos(_db.Set<LeaveRequest>().Where(r => r.EmployeeId == employeeId)));
    }

    [HttpGet("pending-manager-approval")]
    [RequirePermission(Permission.Leave.ApproveAsManager)]
    public async Task<ActionResult<List<LeaveRequestDto>>> PendingManagerApproval()
    {
        // A manager only ever sees requests from people who report directly to them.
        if (CurrentEmployeeId is not { } managerId) return Ok(new List<LeaveRequestDto>());

        var directReportIds = await _db.Set<Employee>()
            .Where(e => e.ReportingManagerId == managerId)
            .Select(e => e.Id)
            .ToListAsync();

        // If this manager is also the tenant's configured fallback approver, their queue
        // additionally covers anyone with no ReportingManagerId at all.
        if (await FallbackApproverIdAsync() == managerId)
        {
            var managerlessIds = await _db.Set<Employee>()
                .Where(e => e.ReportingManagerId == null)
                .Select(e => e.Id)
                .ToListAsync();
            directReportIds = directReportIds.Union(managerlessIds).ToList();
        }

        return Ok(await BuildDtos(_db.Set<LeaveRequest>()
            .Where(r => directReportIds.Contains(r.EmployeeId) && r.Status == LeaveRequestStatus.PendingManagerApproval)));
    }

    [HttpGet("pending-hr-approval")]
    [RequirePermission(Permission.Leave.ApproveAsHr)]
    public async Task<ActionResult<List<LeaveRequestDto>>> PendingHrApproval()
    {
        // HR's queue is company-wide, not limited to a reporting line — it's the final gate
        // after a request has already cleared its own manager. Nothing still awaiting the
        // manager (or rejected by them) ever appears here — that's enforced by this filter,
        // not just by convention.
        return Ok(await BuildDtos(_db.Set<LeaveRequest>().Where(r => r.Status == LeaveRequestStatus.PendingHrApproval)));
    }

    [HttpGet("balances/mine")]
    [RequirePermission(Permission.Leave.View)]
    public async Task<ActionResult<List<LeaveBalanceDto>>> MyBalances()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<LeaveBalanceDto>());

        var year = DateTime.UtcNow.Year;
        var leaveTypes = await _db.Set<LeaveType>().ToDictionaryAsync(t => t.Id, t => t.Name);
        var balances = await _db.Set<LeaveBalance>()
            .Where(b => b.EmployeeId == employeeId && b.Year == year)
            .ToListAsync();

        return Ok(balances.Select(b => new LeaveBalanceDto(
            leaveTypes.TryGetValue(b.LeaveTypeId, out var name) ? name : "—",
            b.Allotted, b.Used, b.Remaining)).ToList());
    }

    // HR's per-employee view — every leave type that exists, with this year's balance for the
    // ones already assigned and zero for the rest, so HR can see gaps as well as amounts.
    [HttpGet("balances/{employeeId:guid}")]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<ActionResult<List<EmployeeLeaveBalanceDto>>> BalancesFor(Guid employeeId)
    {
        var year = DateTime.UtcNow.Year;
        var leaveTypes = await _db.Set<LeaveType>().OrderBy(t => t.Name).ToListAsync();
        var balances = await _db.Set<LeaveBalance>()
            .Where(b => b.EmployeeId == employeeId && b.Year == year)
            .ToDictionaryAsync(b => b.LeaveTypeId);

        return Ok(leaveTypes.Select(t =>
        {
            var balance = balances.GetValueOrDefault(t.Id);
            return new EmployeeLeaveBalanceDto(t.Id, t.Name, balance?.Allotted ?? 0, balance?.Used ?? 0, balance?.Remaining ?? 0);
        }).ToList());
    }

    // Sets this year's allotment per leave type for one employee — the per-person control HR
    // needs instead of everyone getting every leave type at the same blanket default.
    [HttpPut("balances/{employeeId:guid}")]
    [RequirePermission(Permission.Leave.ConfigurePolicy)]
    public async Task<IActionResult> SetBalances(Guid employeeId, List<LeaveAllotmentInput> allotments)
    {
        var employeeExists = await _db.Set<Employee>().AnyAsync(e => e.Id == employeeId);
        if (!employeeExists) return NotFound();

        var validLeaveTypeIds = await _db.Set<LeaveType>().Select(t => t.Id).ToHashSetAsync();
        var year = DateTime.UtcNow.Year;
        var existingBalances = await _db.Set<LeaveBalance>()
            .Where(b => b.EmployeeId == employeeId && b.Year == year)
            .ToDictionaryAsync(b => b.LeaveTypeId);

        foreach (var allotment in allotments)
        {
            if (!validLeaveTypeIds.Contains(allotment.LeaveTypeId) || allotment.Allotted < 0) continue;

            if (existingBalances.TryGetValue(allotment.LeaveTypeId, out var balance))
            {
                balance.Allotted = allotment.Allotted;
            }
            else
            {
                _db.Set<LeaveBalance>().Add(new LeaveBalance { EmployeeId = employeeId, LeaveTypeId = allotment.LeaveTypeId, Year = year, Allotted = allotment.Allotted });
            }
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "leave.balances_set",
            EntityType = "Employee",
            EntityId = employeeId,
            Metadata = $"{{\"count\":{allotments.Count}}}",
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    private async Task<List<LeaveRequestDto>> BuildDtos(IQueryable<LeaveRequest> query)
    {
        var requests = await query.OrderByDescending(r => r.CreatedAtUtc).ToListAsync();
        var employees = await _db.Set<Employee>().ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
        var leaveTypes = await _db.Set<LeaveType>().ToDictionaryAsync(t => t.Id, t => t.Name);

        var actorUserIds = requests.SelectMany(r => new[] { r.ManagerActedByUserId, r.HrActedByUserId })
            .Where(id => id is not null).Select(id => id!.Value).Distinct().ToList();
        var actorEmployeeIds = await _db.Users.Where(u => actorUserIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.EmployeeId);
        var actorNames = await _db.Set<Employee>()
            .Where(e => actorEmployeeIds.Values.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        string? ActorName(Guid? userId) =>
            userId is { } id && actorEmployeeIds.TryGetValue(id, out var empId) && empId is { } eid && actorNames.TryGetValue(eid, out var name) ? name : null;

        return requests.Select(r => new LeaveRequestDto(
            r.Id,
            r.EmployeeId,
            employees.TryGetValue(r.EmployeeId, out var employeeName) ? employeeName : "—",
            leaveTypes.TryGetValue(r.LeaveTypeId, out var typeName) ? typeName : "—",
            r.StartDate, r.EndDate, r.DaysRequested, r.Status.ToString(), r.Reason,
            r.ManagerApprovalStatus.ToString(), ActorName(r.ManagerActedByUserId), r.ManagerActedAtUtc, r.ManagerComment,
            r.HrApprovalStatus.ToString(), ActorName(r.HrActedByUserId), r.HrActedAtUtc, r.HrComment,
            r.Status is LeaveRequestStatus.PendingManagerApproval or LeaveRequestStatus.PendingHrApproval)).ToList();
    }

    [HttpPost]
    [RequirePermission(Permission.Leave.Submit)]
    public async Task<IActionResult> Submit(SubmitLeaveRequest request)
    {
        if (CurrentEmployeeId is not { } employeeId)
            return BadRequest("This account isn't linked to an employee record yet.");

        if (request.EndDate < request.StartDate)
            return BadRequest("End date can't be before the start date.");

        var isHalfDay = request.Half != LeaveHalf.None;
        if (isHalfDay && request.StartDate != request.EndDate)
            return BadRequest("A half-day request must be for a single date.");

        var leaveType = await _db.Set<LeaveType>().FirstOrDefaultAsync(t => t.Id == request.LeaveTypeId);
        if (leaveType is null) return BadRequest("Unknown leave type.");
        if (isHalfDay && !leaveType.AllowsHalfDay) return BadRequest("This leave type doesn't support half-day requests.");

        var daysRequested = isHalfDay ? 0.5m : (request.EndDate.DayNumber - request.StartDate.DayNumber + 1);

        // Self-certification threshold: beyond N consecutive days, a certificate is mandatory
        // before the request can even be queued for a manager to see.
        if (leaveType.RequiresCertificateBeyondDays
            && daysRequested > leaveType.SelfCertificationLimitDays
            && string.IsNullOrWhiteSpace(request.MedicalCertificateUrl))
        {
            return BadRequest($"A medical certificate is required for {leaveType.Name} beyond {leaveType.SelfCertificationLimitDays} day(s).");
        }

        // Conflict check: no overlapping pending/approved request, and no duplicate full-day
        // debit landing on a date that already has a half-day debit (or vice versa).
        var hasOverlap = await _db.Set<LeaveRequest>().AnyAsync(r =>
            r.EmployeeId == employeeId &&
            r.Status != LeaveRequestStatus.RejectedByManager && r.Status != LeaveRequestStatus.RejectedByHr && r.Status != LeaveRequestStatus.Cancelled &&
            r.StartDate <= request.EndDate && r.EndDate >= request.StartDate);
        if (hasOverlap) return Conflict("You already have a request covering one of these dates.");

        // Balances are always keyed by the current year — the year HR assigns them in
        // (Manage leave, new-hire allotment) — not the leave's own start date, otherwise a
        // request spanning or falling near a year boundary would look up a balance row that
        // was never created and silently read as zero.
        var year = DateTime.UtcNow.Year;
        var balance = await _db.Set<LeaveBalance>().FirstOrDefaultAsync(b =>
            b.EmployeeId == employeeId && b.LeaveTypeId == leaveType.Id && b.Year == year);
        var remaining = balance?.Remaining ?? 0;
        if (remaining < daysRequested)
            return BadRequest($"Insufficient balance: {remaining} day(s) remaining, {daysRequested} requested.");

        var leaveRequest = new LeaveRequest
        {
            EmployeeId = employeeId,
            LeaveTypeId = leaveType.Id,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Half = request.Half,
            DaysRequested = daysRequested,
            Reason = request.Reason,
            MedicalCertificateUrl = request.MedicalCertificateUrl,
        };
        _db.Set<LeaveRequest>().Add(leaveRequest);
        await _db.SaveChangesAsync();

        var workflow = await _workflow.StartAsync(WorkflowDefinitions.LeaveRequest, leaveRequest.Id);
        leaveRequest.WorkflowInstanceId = workflow.Id;
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Mine), new { id = leaveRequest.Id });
    }

    // The employee's own request, and only while it's still in one of the two pending states.
    // A request that's already been finally approved needs a proper cancellation workflow
    // (it may already have been debited, attendance may already reflect it) rather than just
    // flipping a status — that's out of scope here, so it's refused outright instead of faked.
    [HttpPost("{id:guid}/cancel")]
    [RequirePermission(Permission.Leave.Submit)]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var leaveRequest = await _db.Set<LeaveRequest>().FirstOrDefaultAsync(r => r.Id == id);
        if (leaveRequest is null) return NotFound();
        if (leaveRequest.EmployeeId != CurrentEmployeeId) return Forbid();

        if (leaveRequest.Status == LeaveRequestStatus.Approved)
            return BadRequest("This leave is already approved. Cancelling an approved leave requires a separate cancellation process.");
        if (leaveRequest.Status is not (LeaveRequestStatus.PendingManagerApproval or LeaveRequestStatus.PendingHrApproval))
            return Conflict("This request has already been decided and can no longer be cancelled.");

        leaveRequest.Status = LeaveRequestStatus.Cancelled;

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = "leave.cancel",
            EntityType = "LeaveRequest",
            EntityId = leaveRequest.Id,
        });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // What a reviewer needs to actually decide, not just the bare request: who they are,
    // their leave balance for this type, and their recent leave history. Open to the request's
    // own assigned manager, anyone holding HR approval, or the employee themselves (their own
    // "My requests" detail) — nobody else.
    [HttpGet("{id:guid}/context")]
    [Authorize]
    public async Task<ActionResult<LeaveReviewContextDto>> Context(Guid id)
    {
        var leaveRequest = await _db.Set<LeaveRequest>().FirstOrDefaultAsync(r => r.Id == id);
        if (leaveRequest is null) return NotFound();

        var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == leaveRequest.EmployeeId);
        if (employee is null) return NotFound();

        var isAssignedManager = User.HasClaim("perm", Permission.Leave.ApproveAsManager) &&
            (employee.ReportingManagerId == CurrentEmployeeId ||
             (employee.ReportingManagerId is null && await FallbackApproverIdAsync() == CurrentEmployeeId));
        var isHr = User.HasClaim("perm", Permission.Leave.ApproveAsHr);
        var isSelf = leaveRequest.EmployeeId == CurrentEmployeeId;
        if (!isAssignedManager && !isHr && !isSelf) return Forbid();

        var year = DateTime.UtcNow.Year;
        var balance = await _db.Set<LeaveBalance>().FirstOrDefaultAsync(b =>
            b.EmployeeId == employee.Id && b.LeaveTypeId == leaveRequest.LeaveTypeId && b.Year == year);
        var leaveTypeNames = await _db.Set<LeaveType>().ToDictionaryAsync(t => t.Id, t => t.Name);
        var departmentName = (await _db.Set<Department>().FirstOrDefaultAsync(d => d.Id == employee.DepartmentId))?.Name ?? "—";

        var history = await _db.Set<LeaveRequest>()
            .Where(r => r.EmployeeId == employee.Id && r.Id != id)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(5)
            .ToListAsync();

        return Ok(new LeaveReviewContextDto(
            $"{employee.FirstName} {employee.LastName}", departmentName,
            leaveTypeNames.GetValueOrDefault(leaveRequest.LeaveTypeId, "—"),
            balance?.Allotted ?? 0, balance?.Used ?? 0, balance?.Remaining ?? 0,
            history.Select(h => new LeaveHistoryItemDto(
                leaveTypeNames.GetValueOrDefault(h.LeaveTypeId, "—"), h.StartDate, h.EndDate, h.DaysRequested, h.Status.ToString())).ToList()));
    }

    // One endpoint, any number of stages: which stage fires is read from the workflow
    // instance itself, never from anything the client sends — so a manager can't skip
    // straight to a final HR approval by calling this a second time or lying about the stage.
    [HttpPost("{id:guid}/decision")]
    [Authorize]
    public async Task<IActionResult> Decide(Guid id, DecideLeaveRequest decision)
    {
        var leaveRequest = await _db.Set<LeaveRequest>().FirstOrDefaultAsync(r => r.Id == id);
        if (leaveRequest is null) return NotFound();

        // Cancellation lives outside the workflow engine's own state (the instance itself
        // stays InProgress), so it needs its own check here — otherwise a cancelled request's
        // still-open workflow instance would let a decision through after the fact.
        if (leaveRequest.Status is not (LeaveRequestStatus.PendingManagerApproval or LeaveRequestStatus.PendingHrApproval))
            return Conflict("This request is no longer awaiting a decision.");

        var workflow = await _workflow.GetAsync(leaveRequest.WorkflowInstanceId);
        if (workflow?.CurrentStage is not { } stage) return Conflict("This request has already been fully decided.");

        return stage switch
        {
            "Manager" => await DecideAsManager(leaveRequest, decision),
            "HR" => await DecideAsHr(leaveRequest, decision),
            _ => Conflict("Unknown workflow stage."),
        };
    }

    private async Task<IActionResult> DecideAsManager(LeaveRequest leaveRequest, DecideLeaveRequest decision)
    {
        if (!User.HasClaim("perm", Permission.Leave.ApproveAsManager)) return Forbid();

        var employee = await _db.Set<Employee>().FirstOrDefaultAsync(e => e.Id == leaveRequest.EmployeeId);
        var isAssignedManager = employee?.ReportingManagerId == CurrentEmployeeId;
        var isFallbackManager = employee?.ReportingManagerId is null && await FallbackApproverIdAsync() == CurrentEmployeeId;
        if (!isAssignedManager && !isFallbackManager)
        {
            await LogDenied("leave.approve_as_manager", leaveRequest.Id);
            return Forbid();
        }

        var outcome = await _workflow.DecideAsync(leaveRequest.WorkflowInstanceId, "Manager", CurrentUserId, decision.Approve, decision.Note);
        if (!outcome.Applied) return Conflict(outcome.Reason);

        // Manager approval is strictly intermediate — even on approval this never sets
        // Status to Approved, only PendingHrApproval. HR is the only stage that can finalize.
        leaveRequest.ManagerActedByUserId = CurrentUserId;
        leaveRequest.ManagerActedAtUtc = DateTimeOffset.UtcNow;
        leaveRequest.ManagerComment = decision.Note;

        if (outcome.IsRejected)
        {
            leaveRequest.Status = LeaveRequestStatus.RejectedByManager;
            leaveRequest.ManagerApprovalStatus = ApprovalStageStatus.Rejected;
            leaveRequest.HrApprovalStatus = ApprovalStageStatus.NotRequired; // never enters the HR queue
        }
        else
        {
            leaveRequest.Status = LeaveRequestStatus.PendingHrApproval;
            leaveRequest.ManagerApprovalStatus = ApprovalStageStatus.Approved;
            leaveRequest.HrApprovalStatus = ApprovalStageStatus.Pending;
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "leave.approve_as_manager" : "leave.reject_as_manager",
            EntityType = "LeaveRequest",
            EntityId = leaveRequest.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IActionResult> DecideAsHr(LeaveRequest leaveRequest, DecideLeaveRequest decision)
    {
        if (!User.HasClaim("perm", Permission.Leave.ApproveAsHr)) return Forbid();

        // HR can only ever act on a request the manager has already approved — the workflow
        // engine already guarantees this (HR is never the CurrentStage otherwise), but this is
        // the same rule stated directly against the domain field, not just the engine's state.
        if (leaveRequest.ManagerApprovalStatus != ApprovalStageStatus.Approved)
            return Conflict("This request hasn't been approved by a manager yet.");

        if (!decision.Approve && string.IsNullOrWhiteSpace(decision.Note))
            return BadRequest("A rejection reason is required.");

        var outcome = await _workflow.DecideAsync(leaveRequest.WorkflowInstanceId, "HR", CurrentUserId, decision.Approve, decision.Note);
        if (!outcome.Applied) return Conflict(outcome.Reason);

        leaveRequest.HrActedByUserId = CurrentUserId;
        leaveRequest.HrActedAtUtc = DateTimeOffset.UtcNow;
        leaveRequest.HrComment = decision.Note;
        leaveRequest.Status = outcome.IsRejected ? LeaveRequestStatus.RejectedByHr : LeaveRequestStatus.Approved;
        leaveRequest.HrApprovalStatus = outcome.IsRejected ? ApprovalStageStatus.Rejected : ApprovalStageStatus.Approved;

        // The balance is debited here and only here — after both the manager and HR have
        // signed off — and keyed by the current year, matching how every balance is stored.
        if (outcome.IsFullyApproved)
        {
            var year = DateTime.UtcNow.Year;
            var balance = await _db.Set<LeaveBalance>().FirstOrDefaultAsync(b =>
                b.EmployeeId == leaveRequest.EmployeeId && b.LeaveTypeId == leaveRequest.LeaveTypeId && b.Year == year);
            if (balance is not null)
            {
                balance.Used += leaveRequest.DaysRequested;
                leaveRequest.BalanceDebited = true;
            }
        }

        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = decision.Approve ? "leave.approve_as_hr" : "leave.reject_as_hr",
            EntityType = "LeaveRequest",
            EntityId = leaveRequest.Id,
        });

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task LogDenied(string action, Guid entityId)
    {
        _db.Set<AuditLog>().Add(new AuditLog
        {
            ActorUserId = CurrentUserId,
            Action = action,
            EntityType = "LeaveRequest",
            EntityId = entityId,
            WasDenied = true,
        });
        await _db.SaveChangesAsync();
    }
}

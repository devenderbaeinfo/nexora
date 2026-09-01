using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Accounting;
using Erp.Domain.Audit;
using Erp.Domain.Identity;
using Erp.Domain.Payroll;
using Erp.Domain.People;
using Erp.Domain.Timecard;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// Salary structures -> a processed run's payslips (Draft) -> Finance approval -> disbursement,
// which posts a real summary Journal Entry to the existing accounting core (Part 8 Flow 6).
// LOP (loss of pay) is computed straight from Approved LeaveRequests under an unpaid LeaveType —
// the actual Leave -> Payroll wiring, not a placeholder. What this deliberately does NOT cover:
// PF/ESI/tax slabs/Form16 (a separate compliance module) and bonuses/arrears/off-cycle runs (v2).
[ApiController]
[Authorize]
[Route("api/payroll")]
public class PayrollController : ControllerBase
{
    private readonly ErpDbContext _db;
    public PayrollController(ErpDbContext db) => _db = db;

    private Guid? CurrentEmployeeId =>
        Guid.TryParse(User.FindFirstValue("employee_id"), out var id) ? id : null;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private bool CanManage => User.HasClaim("perm", Permission.Payroll.Manage);
    private bool CanApprove => User.HasClaim("perm", Permission.Payroll.Approve);

    // ---------- Salary structures ----------

    [HttpGet("salary-structures/{employeeId:guid}")]
    [RequirePermission(Permission.Payroll.View)]
    public async Task<ActionResult<SalaryStructureDto?>> GetSalaryStructure(Guid employeeId)
    {
        if (!CanManage && employeeId != CurrentEmployeeId) return Forbid();

        var structure = await _db.SalaryStructures
            .Where(s => s.EmployeeId == employeeId && s.IsActive)
            .FirstOrDefaultAsync();
        if (structure is null) return Ok(null);

        return Ok(await BuildStructureDto(structure));
    }

    [HttpPut("salary-structures/{employeeId:guid}")]
    [RequirePermission(Permission.Payroll.Manage)]
    public async Task<ActionResult<SalaryStructureDto>> SetSalaryStructure(Guid employeeId, SetSalaryStructureRequest request)
    {
        var employeeExists = await _db.Employees.AnyAsync(e => e.Id == employeeId);
        if (!employeeExists) return BadRequest("Unknown employee.");

        if (request.Components is null || request.Components.Count == 0)
            return BadRequest("A salary structure needs at least one component.");
        if (request.Components.Any(c => c.Value < 0))
            return BadRequest("Component values can't be negative.");

        var parsed = new List<(string Name, SalaryComponentType Type, SalaryCalculationType Calc, decimal Value, bool IsBasic)>();
        foreach (var c in request.Components)
        {
            if (string.IsNullOrWhiteSpace(c.Name)) return BadRequest("Every component needs a name.");
            if (!Enum.TryParse<SalaryComponentType>(c.Type, out var type)) return BadRequest($"Unknown component type '{c.Type}'.");
            if (!Enum.TryParse<SalaryCalculationType>(c.CalculationType, out var calc)) return BadRequest($"Unknown calculation type '{c.CalculationType}'.");
            if (c.IsBasic && (type != SalaryComponentType.Earning || calc != SalaryCalculationType.FixedAmount))
                return BadRequest("Basic must be an Earning with a fixed amount.");
            parsed.Add((c.Name.Trim(), type, calc, c.Value, c.IsBasic));
        }

        var basicCount = parsed.Count(c => c.IsBasic);
        if (basicCount != 1) return BadRequest("Exactly one earning component must be marked as Basic — every percentage-based component calculates off it.");

        var existingActive = await _db.SalaryStructures.Where(s => s.EmployeeId == employeeId && s.IsActive).ToListAsync();
        foreach (var old in existingActive) old.IsActive = false;

        var structure = new SalaryStructure { EmployeeId = employeeId, EffectiveFrom = request.EffectiveFrom, IsActive = true };
        _db.SalaryStructures.Add(structure);
        await _db.SaveChangesAsync();

        var sortOrder = 0;
        foreach (var c in parsed)
        {
            _db.SalaryComponents.Add(new SalaryComponent
            {
                SalaryStructureId = structure.Id, Name = c.Name, Type = c.Type,
                CalculationType = c.Calc, Value = c.Value, IsBasic = c.IsBasic, SortOrder = sortOrder++,
            });
        }

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId, Action = "payroll.set_salary_structure",
            EntityType = "Employee", EntityId = employeeId,
        });

        await _db.SaveChangesAsync();
        return Ok(await BuildStructureDto(structure));
    }

    // ---------- Payroll runs ----------

    [HttpGet("runs")]
    public async Task<ActionResult<List<PayrollRunDto>>> ListRuns()
    {
        if (!CanManage && !CanApprove) return Forbid();

        var runs = await _db.PayrollRuns.OrderByDescending(r => r.PeriodYear).ThenByDescending(r => r.PeriodMonth).ToListAsync();
        return Ok(await BuildRunDtos(runs));
    }

    [HttpGet("runs/{id:guid}")]
    public async Task<ActionResult<PayrollRunDto>> GetRun(Guid id)
    {
        if (!CanManage && !CanApprove) return Forbid();

        var run = await _db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return NotFound();
        return Ok((await BuildRunDtos([run])).First());
    }

    [HttpGet("runs/{id:guid}/payslips")]
    public async Task<ActionResult<List<PayslipListItemDto>>> RunPayslips(Guid id)
    {
        if (!CanManage && !CanApprove) return Forbid();

        var runExists = await _db.PayrollRuns.AnyAsync(r => r.Id == id);
        if (!runExists) return NotFound();

        var payslips = await _db.Payslips.Where(p => p.PayrollRunId == id).ToListAsync();
        var employees = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");

        return Ok(payslips.OrderBy(p => employees.TryGetValue(p.EmployeeId, out var n) ? n : "").Select(p => new PayslipListItemDto(
            p.Id, p.EmployeeId, employees.TryGetValue(p.EmployeeId, out var name) ? name : "—",
            p.GrossEarnings, p.LopDays, p.LopDeduction, p.OtherDeductions, p.NetPay)).ToList());
    }

    // Computes every active employee's payslip for the given month in one pass. Employees
    // with no active salary structure are skipped, not silently zeroed — HR sees exactly
    // who still needs one set up.
    [HttpPost("runs")]
    [RequirePermission(Permission.Payroll.Manage)]
    public async Task<ActionResult<PayrollRunDto>> ProcessRun(ProcessPayrollRequest request)
    {
        if (request.PeriodMonth is < 1 or > 12) return BadRequest("Month must be between 1 and 12.");
        if (request.PeriodYear is < 2000 or > 2100) return BadRequest("Year looks wrong.");

        var alreadyExists = await _db.PayrollRuns.AnyAsync(r => r.PeriodMonth == request.PeriodMonth && r.PeriodYear == request.PeriodYear);
        if (alreadyExists) return Conflict("A payroll run already exists for this period.");

        var periodStart = new DateOnly(request.PeriodYear, request.PeriodMonth, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);
        var daysInMonth = periodEnd.Day;

        var employees = await _db.Employees.Where(e => e.Status == EmploymentStatus.Active).ToListAsync();
        var employeeIds = employees.Select(e => e.Id).ToList();

        var activeStructures = await _db.SalaryStructures
            .Where(s => employeeIds.Contains(s.EmployeeId) && s.IsActive)
            .ToListAsync();
        var structureIds = activeStructures.Select(s => s.Id).ToList();
        var componentsByStructure = (await _db.SalaryComponents.Where(c => structureIds.Contains(c.SalaryStructureId)).ToListAsync())
            .GroupBy(c => c.SalaryStructureId).ToDictionary(g => g.Key, g => g.OrderBy(c => c.SortOrder).ToList());

        // Unpaid-leave requests overlapping this period, across all employees in one query —
        // avoids an N+1 round trip per employee during a full-company run.
        var unpaidLeave = await (
            from lr in _db.LeaveRequests
            join lt in _db.LeaveTypes on lr.LeaveTypeId equals lt.Id
            where employeeIds.Contains(lr.EmployeeId)
                && lr.Status == LeaveRequestStatus.Approved
                && !lt.IsPaidLeave
                && lr.StartDate <= periodEnd && lr.EndDate >= periodStart
            select lr
        ).ToListAsync();

        var run = new PayrollRun { PeriodMonth = request.PeriodMonth, PeriodYear = request.PeriodYear, Status = PayrollRunStatus.Draft };
        _db.PayrollRuns.Add(run);
        await _db.SaveChangesAsync();

        var skipped = new List<string>();

        foreach (var employee in employees)
        {
            var structure = activeStructures.FirstOrDefault(s => s.EmployeeId == employee.Id);
            if (structure is null || !componentsByStructure.TryGetValue(structure.Id, out var components) || components.Count == 0)
            {
                skipped.Add($"{employee.FirstName} {employee.LastName}");
                continue;
            }

            var basic = components.First(c => c.IsBasic).Value;
            decimal Amount(SalaryComponent c) => c.CalculationType == SalaryCalculationType.FixedAmount ? c.Value : Math.Round(basic * c.Value / 100m, 2);

            var earningLines = components.Where(c => c.Type == SalaryComponentType.Earning).Select(c => (c.Name, c.SortOrder, Amount: Amount(c))).ToList();
            var deductionLines = components.Where(c => c.Type == SalaryComponentType.Deduction).Select(c => (c.Name, c.SortOrder, Amount: Amount(c))).ToList();

            var grossEarnings = earningLines.Sum(l => l.Amount);
            var otherDeductions = deductionLines.Sum(l => l.Amount);
            var lopDays = LopDaysFor(employee.Id, unpaidLeave, periodStart, periodEnd);
            var lopDeduction = daysInMonth == 0 ? 0 : Math.Round(grossEarnings / daysInMonth * lopDays, 2);
            var netPay = grossEarnings - lopDeduction - otherDeductions;

            var payslip = new Payslip
            {
                PayrollRunId = run.Id, EmployeeId = employee.Id, DaysInMonth = daysInMonth, LopDays = lopDays,
                GrossEarnings = grossEarnings, LopDeduction = lopDeduction, OtherDeductions = otherDeductions, NetPay = netPay,
            };
            _db.Payslips.Add(payslip);
            await _db.SaveChangesAsync();

            foreach (var l in earningLines)
                _db.PayslipLines.Add(new PayslipLine { PayslipId = payslip.Id, ComponentName = l.Name, Type = SalaryComponentType.Earning, Amount = l.Amount, SortOrder = l.SortOrder });
            foreach (var l in deductionLines)
                _db.PayslipLines.Add(new PayslipLine { PayslipId = payslip.Id, ComponentName = l.Name, Type = SalaryComponentType.Deduction, Amount = l.Amount, SortOrder = l.SortOrder });
            if (lopDeduction > 0)
                _db.PayslipLines.Add(new PayslipLine { PayslipId = payslip.Id, ComponentName = "Loss of Pay", Type = SalaryComponentType.Deduction, Amount = lopDeduction, SortOrder = 999 });
        }

        run.SkippedEmployeeNames = skipped.Count == 0 ? null : string.Join(", ", skipped);

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = CurrentUserId, Action = "payroll.process_run",
            EntityType = "PayrollRun", EntityId = run.Id,
            Metadata = $"{{\"period\":\"{request.PeriodYear}-{request.PeriodMonth:D2}\",\"skipped\":{skipped.Count}}}",
        });

        await _db.SaveChangesAsync();
        return Ok((await BuildRunDtos([run])).First());
    }

    [HttpPost("runs/{id:guid}/approve")]
    [RequirePermission(Permission.Payroll.Approve)]
    public async Task<IActionResult> ApproveRun(Guid id)
    {
        var run = await _db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return NotFound();
        if (run.Status != PayrollRunStatus.Draft) return Conflict("Only a Draft run can be approved.");

        run.Status = PayrollRunStatus.Approved;
        run.ApprovedByUserId = CurrentUserId;
        run.ApprovedAtUtc = DateTimeOffset.UtcNow;

        _db.AuditLogs.Add(new AuditLog { ActorUserId = CurrentUserId, Action = "payroll.approve_run", EntityType = "PayrollRun", EntityId = run.Id });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // The final stage: releases funds and posts a summary entry to the accounting core
    // (Part 8 Flow 6) — Debit Salary Expense (net of LOP), Credit Deductions Payable and
    // Cash/Bank. Requires the tenant to already have at least one cash/bank account set up;
    // this endpoint auto-provisions the two payroll-specific ledger accounts if they don't
    // exist yet, but won't invent a Cash account — that's a real Finance decision, not ours.
    [HttpPost("runs/{id:guid}/disburse")]
    [RequirePermission(Permission.Payroll.Approve)]
    public async Task<IActionResult> DisburseRun(Guid id)
    {
        var run = await _db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return NotFound();
        if (run.Status != PayrollRunStatus.Approved) return Conflict("Only an Approved run can be disbursed.");

        var payslips = await _db.Payslips.Where(p => p.PayrollRunId == id).ToListAsync();
        if (payslips.Count == 0) return Conflict("This run has no payslips to disburse.");

        var cashAccount = await _db.Accounts.Where(a => a.IsCashAccount && a.IsActive).OrderBy(a => a.Code).FirstOrDefaultAsync();
        if (cashAccount is null)
            return Conflict("No active cash/bank account exists in your Chart of Accounts yet. Add one under Accounting before disbursing payroll.");

        var salaryExpenseAccount = await FindOrCreateAccount("PAYROLL-EXP", "Salary Expense", AccountType.Expense);
        var deductionsPayableAccount = await FindOrCreateAccount("PAYROLL-DED-PAYABLE", "Payroll Deductions Payable", AccountType.Liability);

        var totalNetExpense = payslips.Sum(p => p.GrossEarnings - p.LopDeduction);
        var totalDeductions = payslips.Sum(p => p.OtherDeductions);
        var totalNetPay = payslips.Sum(p => p.NetPay);

        var entry = new JournalEntry
        {
            EntryDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Memo = $"Payroll disbursement — {run.PeriodYear}-{run.PeriodMonth:D2}",
            PostedByUserId = CurrentUserId,
        };
        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        _db.JournalLines.Add(new JournalLine { JournalEntryId = entry.Id, AccountId = salaryExpenseAccount.Id, Debit = totalNetExpense, Credit = 0 });
        if (totalDeductions > 0)
            _db.JournalLines.Add(new JournalLine { JournalEntryId = entry.Id, AccountId = deductionsPayableAccount.Id, Debit = 0, Credit = totalDeductions });
        _db.JournalLines.Add(new JournalLine { JournalEntryId = entry.Id, AccountId = cashAccount.Id, Debit = 0, Credit = totalNetPay });

        run.Status = PayrollRunStatus.Disbursed;
        run.DisbursedByUserId = CurrentUserId;
        run.DisbursedAtUtc = DateTimeOffset.UtcNow;
        run.JournalEntryId = entry.Id;

        _db.AuditLogs.Add(new AuditLog { ActorUserId = CurrentUserId, Action = "payroll.disburse_run", EntityType = "PayrollRun", EntityId = run.Id });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<Account> FindOrCreateAccount(string code, string name, AccountType type)
    {
        var existing = await _db.Accounts.FirstOrDefaultAsync(a => a.Name == name && a.Type == type);
        if (existing is not null) return existing;

        var account = new Account { Code = code, Name = name, Type = type };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();
        return account;
    }

    private static decimal LopDaysFor(Guid employeeId, List<LeaveRequest> unpaidLeave, DateOnly periodStart, DateOnly periodEnd)
    {
        decimal total = 0;
        foreach (var lr in unpaidLeave.Where(l => l.EmployeeId == employeeId))
        {
            if (lr.StartDate == lr.EndDate)
            {
                total += lr.Half == LeaveHalf.None ? 1m : 0.5m;
                continue;
            }

            var overlapStart = lr.StartDate > periodStart ? lr.StartDate : periodStart;
            var overlapEnd = lr.EndDate < periodEnd ? lr.EndDate : periodEnd;
            if (overlapEnd >= overlapStart)
                total += overlapEnd.DayNumber - overlapStart.DayNumber + 1;
        }
        return total;
    }

    // ---------- Self-service payslips ----------

    [HttpGet("payslips/mine")]
    [RequirePermission(Permission.Payroll.View)]
    public async Task<ActionResult<List<PayslipListItemDto>>> MyPayslips()
    {
        if (CurrentEmployeeId is not { } employeeId) return Ok(new List<PayslipListItemDto>());
        return await PayslipsForEmployee(employeeId);
    }

    [HttpGet("employees/{employeeId:guid}/payslips")]
    [RequirePermission(Permission.Payroll.View)]
    public async Task<ActionResult<List<PayslipListItemDto>>> PayslipsFor(Guid employeeId)
    {
        if (!CanManage && !CanApprove && employeeId != CurrentEmployeeId) return Forbid();
        return await PayslipsForEmployee(employeeId);
    }

    private async Task<ActionResult<List<PayslipListItemDto>>> PayslipsForEmployee(Guid employeeId)
    {
        var payslips = await _db.Payslips.Where(p => p.EmployeeId == employeeId).ToListAsync();
        var runIds = payslips.Select(p => p.PayrollRunId).ToList();
        var runs = await _db.PayrollRuns.Where(r => runIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, r => r);

        var employeeName = await _db.Employees.Where(e => e.Id == employeeId)
            .Select(e => e.FirstName + " " + e.LastName).FirstOrDefaultAsync() ?? "—";

        return Ok(payslips
            .OrderByDescending(p => runs.TryGetValue(p.PayrollRunId, out var r) ? r.PeriodYear * 100 + r.PeriodMonth : 0)
            .Select(p => new PayslipListItemDto(p.Id, employeeId, employeeName, p.GrossEarnings, p.LopDays, p.LopDeduction, p.OtherDeductions, p.NetPay))
            .ToList());
    }

    [HttpGet("payslips/{id:guid}")]
    [RequirePermission(Permission.Payroll.View)]
    public async Task<ActionResult<PayslipDetailDto>> PayslipDetail(Guid id)
    {
        var payslip = await _db.Payslips.FirstOrDefaultAsync(p => p.Id == id);
        if (payslip is null) return NotFound();
        if (!CanManage && !CanApprove && payslip.EmployeeId != CurrentEmployeeId) return Forbid();

        var run = await _db.PayrollRuns.FirstOrDefaultAsync(r => r.Id == payslip.PayrollRunId);
        var employeeName = await _db.Employees.Where(e => e.Id == payslip.EmployeeId)
            .Select(e => e.FirstName + " " + e.LastName).FirstOrDefaultAsync() ?? "—";
        var lines = await _db.PayslipLines.Where(l => l.PayslipId == id).OrderBy(l => l.SortOrder).ToListAsync();

        return Ok(new PayslipDetailDto(
            payslip.Id, payslip.PayrollRunId, run?.PeriodMonth ?? 0, run?.PeriodYear ?? 0, employeeName,
            payslip.DaysInMonth, payslip.LopDays, payslip.GrossEarnings, payslip.LopDeduction,
            payslip.OtherDeductions, payslip.NetPay,
            lines.Select(l => new PayslipLineDto(l.ComponentName, l.Type.ToString(), l.Amount)).ToList()));
    }

    private async Task<SalaryStructureDto> BuildStructureDto(SalaryStructure structure)
    {
        var components = await _db.SalaryComponents.Where(c => c.SalaryStructureId == structure.Id).OrderBy(c => c.SortOrder).ToListAsync();
        return new SalaryStructureDto(structure.Id, structure.EmployeeId, structure.EffectiveFrom, structure.IsActive,
            components.Select(c => new SalaryComponentDto(c.Id, c.Name, c.Type.ToString(), c.CalculationType.ToString(), c.Value, c.IsBasic, c.SortOrder)).ToList());
    }

    private async Task<List<PayrollRunDto>> BuildRunDtos(List<PayrollRun> runs)
    {
        var runIds = runs.Select(r => r.Id).ToList();
        var payslips = await _db.Payslips.Where(p => runIds.Contains(p.PayrollRunId)).ToListAsync();

        return runs.Select(r =>
        {
            var runPayslips = payslips.Where(p => p.PayrollRunId == r.Id).ToList();
            var skipped = string.IsNullOrWhiteSpace(r.SkippedEmployeeNames)
                ? []
                : r.SkippedEmployeeNames.Split(", ", StringSplitOptions.RemoveEmptyEntries).ToList();

            return new PayrollRunDto(
                r.Id, r.PeriodMonth, r.PeriodYear, r.Status.ToString(),
                runPayslips.Count, runPayslips.Sum(p => p.NetPay),
                r.CreatedAtUtc, r.ApprovedAtUtc, r.DisbursedAtUtc, r.JournalEntryId, skipped);
        }).ToList();
    }
}

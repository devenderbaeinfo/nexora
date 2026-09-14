using System.Security.Claims;
using Nexora.Shared.Authorization;
using Nexora.Modules.Finance.Contracts;
using Nexora.Modules.Finance.Entities;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Finance.Services;
using Nexora.Api.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Finance.Controllers;

// FIN-10: Accounts Payable. Single-stage (no submitter's-manager step — there's no submitter
// employee here, just whoever holds AccountsPayable.Manage) unlike Leave/Expense's two-stage
// engine: Pending -> Approve (posts Debit "{Category} Expense" / Credit "Accounts Payable",
// the account AccountSync already seeds as code 2000) -> Pay (Debit "Accounts Payable" /
// Credit Cash). Both postings go through the same IAccountingPostingService every other
// module uses, so a vendor bill's GL entries are indistinguishable from a hand-entered one.
[ApiController]
[Authorize]
[Route("api/vendor-bills")]
public class VendorBillsController : ControllerBase
{
    private readonly NexoraDbContext _db;
    private readonly IAccountingPostingService _accounting;
    public VendorBillsController(NexoraDbContext db, IAccountingPostingService accounting)
    {
        _db = db;
        _accounting = accounting;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    // ---------- Vendors ----------

    [HttpGet("vendors")]
    [RequirePermission(Permission.AccountsPayable.View)]
    public async Task<ActionResult<List<VendorDto>>> Vendors()
    {
        var vendors = await _db.Vendors.OrderBy(v => v.Name).ToListAsync();
        return Ok(vendors.Select(v => new VendorDto(v.Id, v.Name, v.ContactEmail, v.ContactPhone, v.IsActive)).ToList());
    }

    [HttpPost("vendors")]
    [RequirePermission(Permission.AccountsPayable.Manage)]
    public async Task<ActionResult<VendorDto>> CreateVendor(CreateVendorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");

        var vendor = new Vendor { Name = request.Name.Trim(), ContactEmail = request.ContactEmail, ContactPhone = request.ContactPhone };
        _db.Vendors.Add(vendor);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Vendors), new VendorDto(vendor.Id, vendor.Name, vendor.ContactEmail, vendor.ContactPhone, vendor.IsActive));
    }

    // ---------- Bills ----------

    [HttpGet("bills")]
    [RequirePermission(Permission.AccountsPayable.View)]
    public async Task<ActionResult<List<VendorBillDto>>> Bills([FromQuery] string? status)
    {
        var query = _db.VendorBills.AsQueryable();
        if (status is not null && Enum.TryParse<VendorBillStatus>(status, out var parsed))
            query = query.Where(b => b.Status == parsed);

        var bills = await query.OrderByDescending(b => b.CreatedAtUtc).ToListAsync();
        return Ok(await BuildDtos(bills));
    }

    private async Task<List<VendorBillDto>> BuildDtos(List<VendorBill> bills)
    {
        var vendors = await _db.Vendors.ToDictionaryAsync(v => v.Id, v => v.Name);
        return bills.Select(b => new VendorBillDto(
            b.Id, b.VendorId, vendors.TryGetValue(b.VendorId, out var name) ? name : "—",
            b.BillNumber, b.BillDate, b.DueDate, b.Category, b.Amount, b.Status.ToString(),
            b.JournalEntryId, b.RejectionReason, b.PaidAtUtc, b.PaymentJournalEntryId)).ToList();
    }

    [HttpPost("bills")]
    [RequirePermission(Permission.AccountsPayable.Manage)]
    public async Task<IActionResult> SubmitBill(SubmitVendorBillRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.BillNumber)) return BadRequest("Bill number is required.");
        if (string.IsNullOrWhiteSpace(request.Category)) return BadRequest("Category is required.");
        if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        if (request.DueDate < request.BillDate) return BadRequest("Due date can't be before the bill date.");

        var vendorExists = await _db.Vendors.AnyAsync(v => v.Id == request.VendorId);
        if (!vendorExists) return BadRequest("Unknown vendor.");

        var duplicate = await _db.VendorBills.AnyAsync(b => b.VendorId == request.VendorId && b.BillNumber == request.BillNumber);
        if (duplicate) return Conflict("A bill with this number already exists for this vendor.");

        var bill = new VendorBill
        {
            VendorId = request.VendorId,
            BillNumber = request.BillNumber.Trim(),
            BillDate = request.BillDate,
            DueDate = request.DueDate,
            Category = request.Category.Trim(),
            Amount = request.Amount,
            SubmittedByUserId = CurrentUserId,
        };
        _db.VendorBills.Add(bill);

        _db.AuditLogs.Add(new AuditLog { ActorUserId = CurrentUserId, Action = "accounts_payable.submit_bill", EntityType = "VendorBill", EntityId = bill.Id });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Bills), null);
    }

    [HttpPost("bills/{id:guid}/approve")]
    [RequirePermission(Permission.AccountsPayable.Approve)]
    public async Task<IActionResult> ApproveBill(Guid id)
    {
        var bill = await _db.VendorBills.FirstOrDefaultAsync(b => b.Id == id);
        if (bill is null) return NotFound();
        if (bill.Status != VendorBillStatus.Pending) return Conflict("Only a Pending bill can be approved.");

        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == bill.VendorId);

        var expenseAccount = await _accounting.FindOrCreateAccountAsync($"{bill.Category} Expense", AccountType.Expense);
        var payableAccount = await _accounting.FindOrCreateAccountAsync("Accounts Payable", AccountType.Liability, "2000");

        var entry = await _accounting.PostAsync(
            DateOnly.FromDateTime(DateTime.UtcNow),
            $"Vendor bill approved — {vendor?.Name ?? "—"} — {bill.BillNumber}",
            CurrentUserId,
            (expenseAccount.Id, bill.Amount, 0),
            (payableAccount.Id, 0, bill.Amount));

        bill.Status = VendorBillStatus.Approved;
        bill.ApprovedByUserId = CurrentUserId;
        bill.ApprovedAtUtc = DateTimeOffset.UtcNow;
        bill.JournalEntryId = entry.Id;

        _db.AuditLogs.Add(new AuditLog { ActorUserId = CurrentUserId, Action = "accounts_payable.approve_bill", EntityType = "VendorBill", EntityId = bill.Id });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("bills/{id:guid}/reject")]
    [RequirePermission(Permission.AccountsPayable.Approve)]
    public async Task<IActionResult> RejectBill(Guid id, RejectVendorBillRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest("A rejection reason is required.");

        var bill = await _db.VendorBills.FirstOrDefaultAsync(b => b.Id == id);
        if (bill is null) return NotFound();
        if (bill.Status != VendorBillStatus.Pending) return Conflict("Only a Pending bill can be rejected.");

        bill.Status = VendorBillStatus.Rejected;
        bill.RejectionReason = request.Reason;

        _db.AuditLogs.Add(new AuditLog { ActorUserId = CurrentUserId, Action = "accounts_payable.reject_bill", EntityType = "VendorBill", EntityId = bill.Id });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Releases funds — requires an active cash/bank account, same guard as Payroll disbursement.
    [HttpPost("bills/{id:guid}/pay")]
    [RequirePermission(Permission.AccountsPayable.Approve)]
    public async Task<IActionResult> PayBill(Guid id)
    {
        var bill = await _db.VendorBills.FirstOrDefaultAsync(b => b.Id == id);
        if (bill is null) return NotFound();
        if (bill.Status != VendorBillStatus.Approved) return Conflict("Only an Approved bill can be paid.");

        var cashAccount = await _db.Accounts.Where(a => a.IsCashAccount && a.IsActive).OrderBy(a => a.Code).FirstOrDefaultAsync();
        if (cashAccount is null)
            return Conflict("No active cash/bank account exists in your Chart of Accounts yet. Add one under Accounting before recording this payment.");

        var payableAccount = await _accounting.FindOrCreateAccountAsync("Accounts Payable", AccountType.Liability, "2000");
        var vendor = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == bill.VendorId);

        var entry = await _accounting.PostAsync(
            DateOnly.FromDateTime(DateTime.UtcNow),
            $"Vendor bill paid — {vendor?.Name ?? "—"} — {bill.BillNumber}",
            CurrentUserId,
            (payableAccount.Id, bill.Amount, 0),
            (cashAccount.Id, 0, bill.Amount));

        bill.Status = VendorBillStatus.Paid;
        bill.PaidAtUtc = DateTimeOffset.UtcNow;
        bill.PaymentJournalEntryId = entry.Id;

        _db.AuditLogs.Add(new AuditLog { ActorUserId = CurrentUserId, Action = "accounts_payable.pay_bill", EntityType = "VendorBill", EntityId = bill.Id });
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

using Nexora.Modules.Finance.Entities;
using Nexora.Api.Persistence;
using Nexora.Shared.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Modules.Finance.Services;

// The shared "post a balanced entry to the GL" primitive — first used by Payroll's
// disbursement, now by Reimbursement/Project Expense final approval too (Part 8 Flow 4:
// Expense -> Reimbursement -> Accounting). Lives here rather than duplicated per controller
// so every module that needs to touch the ledger goes through one balance-enforcing chokepoint,
// same reasoning as ApprovalWorkflowService being one engine instead of three hand-rolled copies.
public interface IAccountingPostingService
{
    Task<Account> FindOrCreateAccountAsync(string name, AccountType type, string? code = null);
    Task<JournalEntry> PostAsync(DateOnly entryDate, string memo, Guid postedByUserId, params (Guid AccountId, decimal Debit, decimal Credit)[] lines);
}

public class AccountingPostingService : IAccountingPostingService
{
    private readonly NexoraDbContext _db;
    private readonly ITenantContext _tenant;
    public AccountingPostingService(NexoraDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Account> FindOrCreateAccountAsync(string name, AccountType type, string? code = null)
    {
        var existing = await _db.Accounts.FirstOrDefaultAsync(a => a.Name == name && a.Type == type);
        if (existing is not null) return existing;

        // A stable, deterministic fallback code when the caller doesn't supply one — auto-created
        // accounts still need a unique Code (TenantId+Code is a unique index). Auto-provisioned
        // accounts (Salary Expense, Employee Payable, etc.) are always the tenant's base
        // currency — a category/liability account like this is never itself foreign-denominated.
        var resolvedCode = code ?? $"AUTO-{name.ToUpperInvariant().Replace(" ", "-")}";
        var baseCurrency = (await _db.Tenants.FirstOrDefaultAsync(t => t.Id == _tenant.TenantId))?.BaseCurrencyCode ?? "INR";
        var account = new Account { Code = resolvedCode, Name = name, Type = type, Currency = baseCurrency };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();
        return account;
    }

    // Mirrors AccountingController.PostJournalEntry's own invariants (>= 2 lines, exactly one
    // of Debit/Credit per line, both sides balance) so a posting made through this service is
    // indistinguishable from one a human entered by hand through the Accounting screens.
    public async Task<JournalEntry> PostAsync(DateOnly entryDate, string memo, Guid postedByUserId, params (Guid AccountId, decimal Debit, decimal Credit)[] lines)
    {
        var nonZeroLines = lines.Where(l => l.Debit > 0 || l.Credit > 0).ToArray();
        if (nonZeroLines.Length < 2)
            throw new InvalidOperationException("A journal entry needs at least two non-zero lines.");
        if (nonZeroLines.Any(l => l.Debit > 0 && l.Credit > 0))
            throw new InvalidOperationException("Each line must be either a debit or a credit, not both.");

        var totalDebit = nonZeroLines.Sum(l => l.Debit);
        var totalCredit = nonZeroLines.Sum(l => l.Credit);
        if (totalDebit != totalCredit)
            throw new InvalidOperationException($"Entry doesn't balance: {totalDebit} debit vs {totalCredit} credit.");

        var entry = new JournalEntry { EntryDate = entryDate, Memo = memo, PostedByUserId = postedByUserId };
        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        foreach (var line in nonZeroLines)
        {
            _db.JournalLines.Add(new JournalLine { JournalEntryId = entry.Id, AccountId = line.AccountId, Debit = line.Debit, Credit = line.Credit });
        }
        await _db.SaveChangesAsync();

        return entry;
    }
}

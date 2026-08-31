using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Accounting;
using Erp.Domain.Identity;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// A minimal but real double-entry core: Chart of Accounts, Journal Entries (posted
// directly — no draft stage), and everything else (Ledger, Trial Balance, P&L, Balance
// Sheet, Cash Flow) is just a different sum over the same JournalLines. No AP/AR
// vendor-bill workflows, no tax codes, no period closing — those need business rules
// (payment terms, tax jurisdictions) this scope deliberately leaves undefined.
[ApiController]
[Authorize]
[Route("api/accounting")]
public class AccountingController : ControllerBase
{
    private readonly ErpDbContext _db;
    public AccountingController(ErpDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpGet("accounts")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<AccountDto>>> Accounts()
    {
        var accounts = await _db.Accounts.OrderBy(a => a.Code).ToListAsync();
        return Ok(accounts.Select(a => new AccountDto(a.Id, a.Code, a.Name, a.Type.ToString(), a.IsCashAccount, a.IsActive)).ToList());
    }

    [HttpPost("accounts")]
    [RequirePermission(Permission.Accounting.PostEntries)]
    public async Task<ActionResult<AccountDto>> CreateAccount(CreateAccountRequest request)
    {
        var code = request.Code.Trim();
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Code and name are required.");

        var codeInUse = await _db.Accounts.AnyAsync(a => a.Code == code);
        if (codeInUse) return Conflict("An account with this code already exists.");

        var account = new Account { Code = code, Name = request.Name.Trim(), Type = request.Type, IsCashAccount = request.IsCashAccount };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Accounts), new AccountDto(account.Id, account.Code, account.Name, account.Type.ToString(), account.IsCashAccount, account.IsActive));
    }

    [HttpGet("journal-entries")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<JournalEntryDto>>> JournalEntriesList()
    {
        var entries = await _db.JournalEntries.OrderByDescending(e => e.EntryDate).Take(50).ToListAsync();
        return Ok(await BuildEntryDtos(entries));
    }

    // Balances by construction: rejected outright if debits and credits don't match to
    // the penny, so nothing ever hits the ledger that isn't already in balance.
    [HttpPost("journal-entries")]
    [RequirePermission(Permission.Accounting.PostEntries)]
    public async Task<IActionResult> PostJournalEntry(CreateJournalEntryRequest request)
    {
        if (request.Lines is null || request.Lines.Count < 2)
            return BadRequest("A journal entry needs at least two lines.");
        if (string.IsNullOrWhiteSpace(request.Memo)) return BadRequest("Memo is required.");
        if (request.Lines.Any(l => l.Debit < 0 || l.Credit < 0 || (l.Debit > 0 && l.Credit > 0) || (l.Debit == 0 && l.Credit == 0)))
            return BadRequest("Each line must have exactly one of Debit or Credit, both non-negative.");

        var totalDebit = request.Lines.Sum(l => l.Debit);
        var totalCredit = request.Lines.Sum(l => l.Credit);
        if (totalDebit != totalCredit) return BadRequest($"Entry doesn't balance: {totalDebit} debit vs {totalCredit} credit.");

        var accountIds = request.Lines.Select(l => l.AccountId).Distinct().ToList();
        var validAccountCount = await _db.Accounts.CountAsync(a => accountIds.Contains(a.Id));
        if (validAccountCount != accountIds.Count) return BadRequest("One or more accounts are unknown.");

        var entry = new JournalEntry { EntryDate = request.EntryDate, Memo = request.Memo.Trim(), PostedByUserId = CurrentUserId };
        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        foreach (var line in request.Lines)
        {
            _db.JournalLines.Add(new JournalLine { JournalEntryId = entry.Id, AccountId = line.AccountId, Debit = line.Debit, Credit = line.Credit });
        }
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(JournalEntriesList), null);
    }

    [HttpGet("ledger/{accountId:guid}")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<LedgerLineDto>>> Ledger(Guid accountId)
    {
        var lines = await (
            from line in _db.JournalLines
            join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
            where line.AccountId == accountId
            orderby entry.EntryDate, entry.CreatedAtUtc
            select new { entry.Id, entry.EntryDate, entry.Memo, line.Debit, line.Credit }
        ).ToListAsync();

        var running = 0m;
        var result = new List<LedgerLineDto>();
        foreach (var line in lines)
        {
            running += line.Debit - line.Credit;
            result.Add(new LedgerLineDto(line.Id, line.EntryDate, line.Memo, line.Debit, line.Credit, running));
        }

        return Ok(result);
    }

    [HttpGet("trial-balance")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<TrialBalanceRowDto>>> TrialBalance()
    {
        var accounts = await _db.Accounts.OrderBy(a => a.Code).ToListAsync();
        var totalsByAccount = await _db.JournalLines
            .GroupBy(l => l.AccountId)
            .Select(g => new { AccountId = g.Key, Debit = g.Sum(l => l.Debit), Credit = g.Sum(l => l.Credit) })
            .ToDictionaryAsync(x => x.AccountId, x => (x.Debit, x.Credit));

        var rows = new List<TrialBalanceRowDto>();
        foreach (var account in accounts)
        {
            var (debit, credit) = totalsByAccount.GetValueOrDefault(account.Id, (0m, 0m));
            var net = debit - credit;
            if (net == 0 && debit == 0 && credit == 0) continue;

            rows.Add(net >= 0
                ? new TrialBalanceRowDto(account.Code, account.Name, account.Type.ToString(), net, 0)
                : new TrialBalanceRowDto(account.Code, account.Name, account.Type.ToString(), 0, -net));
        }

        return Ok(rows);
    }

    [HttpGet("profit-and-loss")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<ProfitAndLossDto>> ProfitAndLoss([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (revenue, expense) = await SumByType(from, to, AccountType.Revenue, AccountType.Expense);
        return Ok(new ProfitAndLossDto(revenue, expense, revenue - expense));
    }

    [HttpGet("balance-sheet")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<BalanceSheetDto>> BalanceSheet([FromQuery] DateOnly? asOf)
    {
        var (assets, liabilities, equity) = await SumAssetsLiabilitiesEquity(asOf);
        var (revenue, expense) = await SumByType(null, asOf, AccountType.Revenue, AccountType.Expense);
        var retainedEarnings = revenue - expense;
        return Ok(new BalanceSheetDto(assets, liabilities, equity + retainedEarnings, retainedEarnings));
    }

    [HttpGet("cash-flow")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<CashFlowDto>> CashFlow([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var cashAccountIds = await _db.Accounts.Where(a => a.IsCashAccount).Select(a => a.Id).ToListAsync();

        var query = from line in _db.JournalLines
                    join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
                    where cashAccountIds.Contains(line.AccountId)
                    select new { entry.EntryDate, line.Debit, line.Credit };

        if (from is { } f) query = query.Where(x => x.EntryDate >= f);
        if (to is { } t) query = query.Where(x => x.EntryDate <= t);

        var lines = await query.ToListAsync();
        var cashIn = lines.Sum(l => l.Debit);
        var cashOut = lines.Sum(l => l.Credit);
        return Ok(new CashFlowDto(cashIn, cashOut, cashIn - cashOut));
    }

    // Six months of P&L + cash position, one point per month, for the Finance dashboard's
    // trend charts. Everything here is the same JournalLine data the other reports already
    // sum — just bucketed by month instead of collapsed into one range.
    [HttpGet("monthly-trend")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<MonthlyTrendPointDto>>> MonthlyTrend()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var firstOfThisMonth = new DateOnly(today.Year, today.Month, 1);
        var months = Enumerable.Range(0, 6).Select(i => firstOfThisMonth.AddMonths(-(5 - i))).ToList();

        var cashAccountIds = await _db.Accounts.Where(a => a.IsCashAccount).Select(a => a.Id).ToHashSetAsync();
        var revenueExpenseAccounts = await _db.Accounts
            .Where(a => a.Type == AccountType.Revenue || a.Type == AccountType.Expense)
            .ToDictionaryAsync(a => a.Id, a => a.Type);

        var allLines = await (
            from line in _db.JournalLines
            join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
            select new { entry.EntryDate, line.AccountId, line.Debit, line.Credit }
        ).ToListAsync();

        var cumulativeCash = allLines
            .Where(l => cashAccountIds.Contains(l.AccountId) && l.EntryDate < months[0])
            .Sum(l => l.Debit - l.Credit);

        var result = new List<MonthlyTrendPointDto>();
        foreach (var monthStart in months)
        {
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var monthLines = allLines.Where(l => l.EntryDate >= monthStart && l.EntryDate <= monthEnd).ToList();

            var revenue = monthLines.Where(l => revenueExpenseAccounts.GetValueOrDefault(l.AccountId) == AccountType.Revenue).Sum(l => l.Credit - l.Debit);
            var expense = monthLines.Where(l => revenueExpenseAccounts.GetValueOrDefault(l.AccountId) == AccountType.Expense).Sum(l => l.Debit - l.Credit);
            cumulativeCash += monthLines.Where(l => cashAccountIds.Contains(l.AccountId)).Sum(l => l.Debit - l.Credit);

            result.Add(new MonthlyTrendPointDto(monthStart.ToString("MMM yyyy"), revenue, expense, revenue - expense, cumulativeCash));
        }

        return Ok(result);
    }

    private async Task<(decimal, decimal)> SumByType(DateOnly? from, DateOnly? to, AccountType creditNormalType, AccountType debitNormalType)
    {
        var accounts = await _db.Accounts.Where(a => a.Type == creditNormalType || a.Type == debitNormalType).ToListAsync();
        var accountIds = accounts.Select(a => a.Id).ToList();

        var query = from line in _db.JournalLines
                    join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
                    where accountIds.Contains(line.AccountId)
                    select new { line.AccountId, entry.EntryDate, line.Debit, line.Credit };

        if (from is { } f) query = query.Where(x => x.EntryDate >= f);
        if (to is { } t) query = query.Where(x => x.EntryDate <= t);

        var lines = await query.ToListAsync();
        var accountTypeById = accounts.ToDictionary(a => a.Id, a => a.Type);

        // Revenue's natural balance is Credit-side; Expense's is Debit-side.
        var creditNormalTotal = lines.Where(l => accountTypeById[l.AccountId] == creditNormalType).Sum(l => l.Credit - l.Debit);
        var debitNormalTotal = lines.Where(l => accountTypeById[l.AccountId] == debitNormalType).Sum(l => l.Debit - l.Credit);
        return (creditNormalTotal, debitNormalTotal);
    }

    private async Task<(decimal Assets, decimal Liabilities, decimal Equity)> SumAssetsLiabilitiesEquity(DateOnly? asOf)
    {
        var accounts = await _db.Accounts.ToListAsync();
        var accountTypeById = accounts.ToDictionary(a => a.Id, a => a.Type);

        var query = from line in _db.JournalLines
                    join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
                    select new { line.AccountId, entry.EntryDate, line.Debit, line.Credit };

        if (asOf is { } d) query = query.Where(x => x.EntryDate <= d);

        var lines = await query.ToListAsync();

        var assets = lines.Where(l => accountTypeById.GetValueOrDefault(l.AccountId) == AccountType.Asset).Sum(l => l.Debit - l.Credit);
        var liabilities = lines.Where(l => accountTypeById.GetValueOrDefault(l.AccountId) == AccountType.Liability).Sum(l => l.Credit - l.Debit);
        var equity = lines.Where(l => accountTypeById.GetValueOrDefault(l.AccountId) == AccountType.Equity).Sum(l => l.Credit - l.Debit);
        return (assets, liabilities, equity);
    }

    private async Task<List<JournalEntryDto>> BuildEntryDtos(List<JournalEntry> entries)
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var lines = await _db.JournalLines.Where(l => entryIds.Contains(l.JournalEntryId)).ToListAsync();
        var accounts = await _db.Accounts.ToDictionaryAsync(a => a.Id, a => a.Name);
        var users = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
        var userEmployeeIds = await _db.Users.ToDictionaryAsync(u => u.Id, u => u.EmployeeId);

        string PostedByName(Guid userId) =>
            userEmployeeIds.TryGetValue(userId, out var empId) && empId is { } eid && users.TryGetValue(eid, out var name) ? name : "—";

        return entries.Select(e => new JournalEntryDto(
            e.Id, e.EntryDate, e.Memo, PostedByName(e.PostedByUserId),
            lines.Where(l => l.JournalEntryId == e.Id)
                .Select(l => new JournalLineDto(l.AccountId, accounts.TryGetValue(l.AccountId, out var name) ? name : "—", l.Debit, l.Credit))
                .ToList())).ToList();
    }
}

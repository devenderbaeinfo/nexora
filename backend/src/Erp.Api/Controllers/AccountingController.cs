using System.Security.Claims;
using Erp.Api.Authorization;
using Erp.Api.Contracts;
using Erp.Domain.Accounting;
using Erp.Domain.Identity;
using Erp.Infrastructure.Authorization;
using Erp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Erp.Api.Controllers;

// A minimal but real double-entry core: Chart of Accounts, Journal Entries (posted
// directly — no draft stage), and everything else (Ledger, Trial Balance, P&L, Balance
// Sheet, Cash Flow) is just a different sum over the same JournalLines. Multi-currency:
// each Account carries its own Currency; a JournalLine is always posted in ITS account's
// currency, with an ExchangeRateToBase locked in at posting time. An entry balances in
// BASE-currency terms across all its lines, not necessarily line-by-line in native currency —
// that's what lets a $20 USD line and a ₹1,664 INR line belong to one balanced entry. Every
// consolidated report (Trial Balance, P&L, Balance Sheet, Cash Flow) sums base-equivalents.
// Deliberately NOT built: automatic period-end FX revaluation / unrealized gain-loss — that
// needs a period-close mechanism this scope doesn't have yet. No AP/AR vendor-bill workflows,
// no tax codes either — those need business rules (payment terms, tax jurisdictions) this
// scope leaves undefined.
[ApiController]
[Authorize]
[Route("api/accounting")]
public class AccountingController : ControllerBase
{
    private readonly ErpDbContext _db;
    private readonly DataScopeService _scope;
    public AccountingController(ErpDbContext db, DataScopeService scope)
    {
        _db = db;
        _scope = scope;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private Guid CurrentTenantId => Guid.Parse(User.FindFirstValue("tenant_id")!);

    private async Task<string> BaseCurrencyAsync() =>
        (await _db.Tenants.FirstOrDefaultAsync(t => t.Id == CurrentTenantId))?.BaseCurrencyCode ?? "INR";

    // IAM-11: null = unrestricted (the "no row = All" default, same as every other unrestricted
    // role today). Accounts have no employee/department owner, so the only narrowing offered is
    // an explicit allowlist of specific accounts — a limited bookkeeper role that should only
    // see certain accounts, not the whole Chart of Accounts.
    private async Task<HashSet<Guid>?> ResolveAllowedAccountIdsAsync()
    {
        var decision = await _scope.ResolveAsync(User, Permission.Accounting.View);
        return decision.Type switch
        {
            DataScopeType.All => null,
            DataScopeType.Specific => decision.SpecificIds.ToHashSet(),
            _ => [],
        };
    }

    [HttpGet("accounts")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<AccountDto>>> Accounts()
    {
        var allowed = await ResolveAllowedAccountIdsAsync();
        var accountsQuery = _db.Accounts.AsQueryable();
        if (allowed is not null) accountsQuery = accountsQuery.Where(a => allowed.Contains(a.Id));
        var accounts = await accountsQuery.OrderBy(a => a.Code).ToListAsync();
        return Ok(accounts.Select(a => new AccountDto(a.Id, a.Code, a.Name, a.Type.ToString(), a.Currency, a.IsCashAccount, a.IsActive)).ToList());
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

        var currency = string.IsNullOrWhiteSpace(request.Currency) ? await BaseCurrencyAsync() : request.Currency.Trim().ToUpperInvariant();

        var account = new Account { Code = code, Name = request.Name.Trim(), Type = request.Type, Currency = currency, IsCashAccount = request.IsCashAccount };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Accounts), new AccountDto(account.Id, account.Code, account.Name, account.Type.ToString(), account.Currency, account.IsCashAccount, account.IsActive));
    }

    // ---------- Exchange rates ----------

    [HttpGet("exchange-rates")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<ExchangeRateDto>>> ExchangeRates()
    {
        var rates = await _db.ExchangeRates.OrderByDescending(r => r.EffectiveDate).ThenBy(r => r.CurrencyCode).ToListAsync();
        return Ok(rates.Select(r => new ExchangeRateDto(r.Id, r.CurrencyCode, r.RateToBase, r.EffectiveDate)).ToList());
    }

    [HttpPost("exchange-rates")]
    [RequirePermission(Permission.Accounting.PostEntries)]
    public async Task<ActionResult<ExchangeRateDto>> CreateExchangeRate(CreateExchangeRateRequest request)
    {
        var code = request.CurrencyCode.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code) || code.Length != 3) return BadRequest("Currency code must be a 3-letter ISO code, e.g. USD.");
        if (request.RateToBase <= 0) return BadRequest("Rate must be greater than zero.");

        var baseCurrency = await BaseCurrencyAsync();
        if (code == baseCurrency) return BadRequest($"That's already the base currency ({baseCurrency}) — it doesn't need a rate.");

        var exists = await _db.ExchangeRates.AnyAsync(r => r.CurrencyCode == code && r.EffectiveDate == request.EffectiveDate);
        if (exists) return Conflict("A rate for this currency and date already exists — edit isn't supported, add a new effective date instead.");

        var rate = new ExchangeRate { CurrencyCode = code, RateToBase = request.RateToBase, EffectiveDate = request.EffectiveDate };
        _db.ExchangeRates.Add(rate);
        await _db.SaveChangesAsync();

        return Ok(new ExchangeRateDto(rate.Id, rate.CurrencyCode, rate.RateToBase, rate.EffectiveDate));
    }

    // ---------- Journal entries ----------

    [HttpGet("journal-entries")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<JournalEntryDto>>> JournalEntriesList()
    {
        var entries = await _db.JournalEntries.OrderByDescending(e => e.EntryDate).Take(50).ToListAsync();
        return Ok(await BuildEntryDtos(entries));
    }

    // Balances by construction — rejected outright if base-currency-equivalent debits and
    // credits don't match (within a one-cent rounding tolerance from rate multiplication), so
    // nothing ever hits the ledger that isn't already in balance.
    [HttpPost("journal-entries")]
    [RequirePermission(Permission.Accounting.PostEntries)]
    public async Task<IActionResult> PostJournalEntry(CreateJournalEntryRequest request)
    {
        if (request.Lines is null || request.Lines.Count < 2)
            return BadRequest("A journal entry needs at least two lines.");
        if (string.IsNullOrWhiteSpace(request.Memo)) return BadRequest("Memo is required.");
        if (request.Lines.Any(l => l.Debit < 0 || l.Credit < 0 || (l.Debit > 0 && l.Credit > 0) || (l.Debit == 0 && l.Credit == 0)))
            return BadRequest("Each line must have exactly one of Debit or Credit, both non-negative.");

        var accountIds = request.Lines.Select(l => l.AccountId).Distinct().ToList();
        var accounts = await _db.Accounts.Where(a => accountIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, a => a);
        if (accounts.Count != accountIds.Count) return BadRequest("One or more accounts are unknown.");

        var baseCurrency = await BaseCurrencyAsync();
        var resolvedRates = new Dictionary<Guid, decimal>();

        foreach (var line in request.Lines)
        {
            var account = accounts[line.AccountId];
            if (account.Currency == baseCurrency) { resolvedRates[line.AccountId] = 1m; continue; }

            if (line.ExchangeRateToBase is { } given)
            {
                if (given <= 0) return BadRequest($"Exchange rate for {account.Name} must be greater than zero.");
                resolvedRates[line.AccountId] = given;
                continue;
            }

            var latestRate = await _db.ExchangeRates
                .Where(r => r.CurrencyCode == account.Currency && r.EffectiveDate <= request.EntryDate)
                .OrderByDescending(r => r.EffectiveDate)
                .FirstOrDefaultAsync();
            if (latestRate is null)
                return BadRequest($"No exchange rate configured for {account.Currency} on or before {request.EntryDate:yyyy-MM-dd}. Add one under Accounting > Exchange Rates first.");
            resolvedRates[line.AccountId] = latestRate.RateToBase;
        }

        var totalBaseDebit = request.Lines.Sum(l => Math.Round(l.Debit * resolvedRates[l.AccountId], 2));
        var totalBaseCredit = request.Lines.Sum(l => Math.Round(l.Credit * resolvedRates[l.AccountId], 2));
        if (Math.Abs(totalBaseDebit - totalBaseCredit) > 0.01m)
            return BadRequest($"Entry doesn't balance in {baseCurrency}: {totalBaseDebit} debit vs {totalBaseCredit} credit.");

        var entry = new JournalEntry { EntryDate = request.EntryDate, Memo = request.Memo.Trim(), PostedByUserId = CurrentUserId };
        _db.JournalEntries.Add(entry);
        await _db.SaveChangesAsync();

        foreach (var line in request.Lines)
        {
            _db.JournalLines.Add(new JournalLine
            {
                JournalEntryId = entry.Id, AccountId = line.AccountId,
                Debit = line.Debit, Credit = line.Credit, ExchangeRateToBase = resolvedRates[line.AccountId],
            });
        }
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(JournalEntriesList), null);
    }

    [HttpGet("ledger/{accountId:guid}")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<LedgerResponseDto>> Ledger(Guid accountId)
    {
        var account = await _db.Accounts.FirstOrDefaultAsync(a => a.Id == accountId);
        if (account is null) return NotFound();

        var allowed = await ResolveAllowedAccountIdsAsync();
        if (allowed is not null && !allowed.Contains(accountId)) return Forbid();

        var lines = await (
            from line in _db.JournalLines
            join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
            where line.AccountId == accountId
            orderby entry.EntryDate, entry.CreatedAtUtc
            select new { entry.Id, entry.EntryDate, entry.Memo, line.Debit, line.Credit }
        ).ToListAsync();

        // Native to the account's own currency — a foreign-currency account's ledger reads
        // like a real bank statement in that currency, not converted line by line.
        var running = 0m;
        var result = new List<LedgerLineDto>();
        foreach (var line in lines)
        {
            running += line.Debit - line.Credit;
            result.Add(new LedgerLineDto(line.Id, line.EntryDate, line.Memo, line.Debit, line.Credit, running));
        }

        return Ok(new LedgerResponseDto(account.Currency, result));
    }

    [HttpGet("trial-balance")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<List<TrialBalanceRowDto>>> TrialBalance()
    {
        var accounts = await _db.Accounts.OrderBy(a => a.Code).ToListAsync();
        var totalsByAccount = await _db.JournalLines
            .GroupBy(l => l.AccountId)
            .Select(g => new { AccountId = g.Key, Debit = g.Sum(l => l.Debit * l.ExchangeRateToBase), Credit = g.Sum(l => l.Credit * l.ExchangeRateToBase) })
            .ToDictionaryAsync(x => x.AccountId, x => (x.Debit, x.Credit));

        var rows = new List<TrialBalanceRowDto>();
        foreach (var account in accounts)
        {
            var (debit, credit) = totalsByAccount.GetValueOrDefault(account.Id, (0m, 0m));
            var net = Math.Round(debit - credit, 2);
            if (net == 0 && debit == 0 && credit == 0) continue;

            rows.Add(net >= 0
                ? new TrialBalanceRowDto(account.Code, account.Name, account.Type.ToString(), account.Currency, net, 0)
                : new TrialBalanceRowDto(account.Code, account.Name, account.Type.ToString(), account.Currency, 0, -net));
        }

        return Ok(rows);
    }

    [HttpGet("profit-and-loss")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<ProfitAndLossDto>> ProfitAndLoss([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var (revenue, expense) = await SumByType(from, to, AccountType.Revenue, AccountType.Expense);
        return Ok(new ProfitAndLossDto(revenue, expense, revenue - expense, await BaseCurrencyAsync()));
    }

    [HttpGet("balance-sheet")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<BalanceSheetDto>> BalanceSheet([FromQuery] DateOnly? asOf)
    {
        var (assets, liabilities, equity) = await SumAssetsLiabilitiesEquity(asOf);
        var (revenue, expense) = await SumByType(null, asOf, AccountType.Revenue, AccountType.Expense);
        var retainedEarnings = revenue - expense;
        return Ok(new BalanceSheetDto(assets, liabilities, equity + retainedEarnings, retainedEarnings, await BaseCurrencyAsync()));
    }

    [HttpGet("cash-flow")]
    [RequirePermission(Permission.Accounting.View)]
    public async Task<ActionResult<CashFlowDto>> CashFlow([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var cashAccountIds = await _db.Accounts.Where(a => a.IsCashAccount).Select(a => a.Id).ToListAsync();

        var query = from line in _db.JournalLines
                    join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
                    where cashAccountIds.Contains(line.AccountId)
                    select new { entry.EntryDate, line.Debit, line.Credit, line.ExchangeRateToBase };

        if (from is { } f) query = query.Where(x => x.EntryDate >= f);
        if (to is { } t) query = query.Where(x => x.EntryDate <= t);

        var lines = await query.ToListAsync();
        var cashIn = lines.Sum(l => l.Debit * l.ExchangeRateToBase);
        var cashOut = lines.Sum(l => l.Credit * l.ExchangeRateToBase);
        return Ok(new CashFlowDto(cashIn, cashOut, cashIn - cashOut, await BaseCurrencyAsync()));
    }

    // Six months of P&L + cash position, one point per month, for the Finance dashboard's
    // trend charts. Everything here is the same JournalLine data the other reports already
    // sum — just bucketed by month instead of collapsed into one range. All base-equivalent.
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
            select new { entry.EntryDate, line.AccountId, line.Debit, line.Credit, line.ExchangeRateToBase }
        ).ToListAsync();

        var cumulativeCash = allLines
            .Where(l => cashAccountIds.Contains(l.AccountId) && l.EntryDate < months[0])
            .Sum(l => (l.Debit - l.Credit) * l.ExchangeRateToBase);

        var result = new List<MonthlyTrendPointDto>();
        foreach (var monthStart in months)
        {
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var monthLines = allLines.Where(l => l.EntryDate >= monthStart && l.EntryDate <= monthEnd).ToList();

            var revenue = monthLines.Where(l => revenueExpenseAccounts.GetValueOrDefault(l.AccountId) == AccountType.Revenue).Sum(l => (l.Credit - l.Debit) * l.ExchangeRateToBase);
            var expense = monthLines.Where(l => revenueExpenseAccounts.GetValueOrDefault(l.AccountId) == AccountType.Expense).Sum(l => (l.Debit - l.Credit) * l.ExchangeRateToBase);
            cumulativeCash += monthLines.Where(l => cashAccountIds.Contains(l.AccountId)).Sum(l => (l.Debit - l.Credit) * l.ExchangeRateToBase);

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
                    select new { line.AccountId, entry.EntryDate, line.Debit, line.Credit, line.ExchangeRateToBase };

        if (from is { } f) query = query.Where(x => x.EntryDate >= f);
        if (to is { } t) query = query.Where(x => x.EntryDate <= t);

        var lines = await query.ToListAsync();
        var accountTypeById = accounts.ToDictionary(a => a.Id, a => a.Type);

        // Revenue's natural balance is Credit-side; Expense's is Debit-side. Base-equivalent throughout.
        var creditNormalTotal = lines.Where(l => accountTypeById[l.AccountId] == creditNormalType).Sum(l => (l.Credit - l.Debit) * l.ExchangeRateToBase);
        var debitNormalTotal = lines.Where(l => accountTypeById[l.AccountId] == debitNormalType).Sum(l => (l.Debit - l.Credit) * l.ExchangeRateToBase);
        return (creditNormalTotal, debitNormalTotal);
    }

    private async Task<(decimal Assets, decimal Liabilities, decimal Equity)> SumAssetsLiabilitiesEquity(DateOnly? asOf)
    {
        var accounts = await _db.Accounts.ToListAsync();
        var accountTypeById = accounts.ToDictionary(a => a.Id, a => a.Type);

        var query = from line in _db.JournalLines
                    join entry in _db.JournalEntries on line.JournalEntryId equals entry.Id
                    select new { line.AccountId, entry.EntryDate, line.Debit, line.Credit, line.ExchangeRateToBase };

        if (asOf is { } d) query = query.Where(x => x.EntryDate <= d);

        var lines = await query.ToListAsync();

        var assets = lines.Where(l => accountTypeById.GetValueOrDefault(l.AccountId) == AccountType.Asset).Sum(l => (l.Debit - l.Credit) * l.ExchangeRateToBase);
        var liabilities = lines.Where(l => accountTypeById.GetValueOrDefault(l.AccountId) == AccountType.Liability).Sum(l => (l.Credit - l.Debit) * l.ExchangeRateToBase);
        var equity = lines.Where(l => accountTypeById.GetValueOrDefault(l.AccountId) == AccountType.Equity).Sum(l => (l.Credit - l.Debit) * l.ExchangeRateToBase);
        return (assets, liabilities, equity);
    }

    private async Task<List<JournalEntryDto>> BuildEntryDtos(List<JournalEntry> entries)
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var lines = await _db.JournalLines.Where(l => entryIds.Contains(l.JournalEntryId)).ToListAsync();
        var accounts = await _db.Accounts.ToDictionaryAsync(a => a.Id, a => a);
        var users = await _db.Employees.ToDictionaryAsync(e => e.Id, e => $"{e.FirstName} {e.LastName}");
        var userEmployeeIds = await _db.Users.ToDictionaryAsync(u => u.Id, u => u.EmployeeId);

        string PostedByName(Guid userId) =>
            userEmployeeIds.TryGetValue(userId, out var empId) && empId is { } eid && users.TryGetValue(eid, out var name) ? name : "—";

        return entries.Select(e => new JournalEntryDto(
            e.Id, e.EntryDate, e.Memo, PostedByName(e.PostedByUserId),
            lines.Where(l => l.JournalEntryId == e.Id)
                .Select(l =>
                {
                    var account = accounts.GetValueOrDefault(l.AccountId);
                    return new JournalLineDto(
                        l.AccountId, account?.Name ?? "—", account?.Currency ?? "—", l.Debit, l.Credit,
                        l.ExchangeRateToBase, Math.Round(l.Debit * l.ExchangeRateToBase, 2), Math.Round(l.Credit * l.ExchangeRateToBase, 2));
                })
                .ToList())).ToList();
    }
}

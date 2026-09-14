namespace Nexora.Modules.Finance.Contracts;

public record AccountDto(Guid Id, string Code, string Name, string Type, string Currency, bool IsCashAccount, bool IsActive);
public record CreateAccountRequest(string Code, string Name, Nexora.Modules.Finance.Entities.AccountType Type, bool IsCashAccount, string? Currency);

// ExchangeRateToBase: required only when the line's account currency differs from the
// tenant's base currency and no rate has been configured for that date — otherwise the
// server resolves it (1 for a base-currency account, or the latest configured rate).
public record JournalLineInput(Guid AccountId, decimal Debit, decimal Credit, decimal? ExchangeRateToBase);
public record CreateJournalEntryRequest(DateOnly EntryDate, string Memo, List<JournalLineInput> Lines);

public record JournalLineDto(
    Guid AccountId, string AccountName, string Currency, decimal Debit, decimal Credit,
    decimal ExchangeRateToBase, decimal BaseDebit, decimal BaseCredit);
public record JournalEntryDto(Guid Id, DateOnly EntryDate, string Memo, string PostedByName, List<JournalLineDto> Lines);

// Native to the account's own currency — a foreign-currency account's ledger reads in that
// currency, not converted, same as a real bank statement would.
public record LedgerLineDto(Guid JournalEntryId, DateOnly EntryDate, string Memo, decimal Debit, decimal Credit, decimal RunningBalance);
public record LedgerResponseDto(string Currency, List<LedgerLineDto> Lines);

// Debit/Credit here are already base-currency equivalents — a Trial Balance's whole point is
// proving the company balances as ONE currency, so native amounts would be meaningless summed.
public record TrialBalanceRowDto(string AccountCode, string AccountName, string Type, string AccountCurrency, decimal Debit, decimal Credit);

public record ProfitAndLossDto(decimal TotalRevenue, decimal TotalExpense, decimal NetIncome, string BaseCurrency);
public record BalanceSheetDto(decimal TotalAssets, decimal TotalLiabilities, decimal TotalEquity, decimal RetainedEarnings, string BaseCurrency);
public record CashFlowDto(decimal CashIn, decimal CashOut, decimal NetChange, string BaseCurrency);
public record MonthlyTrendPointDto(string Month, decimal Revenue, decimal Expense, decimal NetIncome, decimal CashPosition);

public record ExchangeRateDto(Guid Id, string CurrencyCode, decimal RateToBase, DateOnly EffectiveDate);
public record CreateExchangeRateRequest(string CurrencyCode, decimal RateToBase, DateOnly EffectiveDate);

namespace Erp.Api.Contracts;

public record AccountDto(Guid Id, string Code, string Name, string Type, bool IsCashAccount, bool IsActive);
public record CreateAccountRequest(string Code, string Name, Erp.Domain.Accounting.AccountType Type, bool IsCashAccount);

public record JournalLineInput(Guid AccountId, decimal Debit, decimal Credit);
public record CreateJournalEntryRequest(DateOnly EntryDate, string Memo, List<JournalLineInput> Lines);

public record JournalLineDto(Guid AccountId, string AccountName, decimal Debit, decimal Credit);
public record JournalEntryDto(Guid Id, DateOnly EntryDate, string Memo, string PostedByName, List<JournalLineDto> Lines);

public record LedgerLineDto(Guid JournalEntryId, DateOnly EntryDate, string Memo, decimal Debit, decimal Credit, decimal RunningBalance);

public record TrialBalanceRowDto(string AccountCode, string AccountName, string Type, decimal Debit, decimal Credit);

public record ProfitAndLossDto(decimal TotalRevenue, decimal TotalExpense, decimal NetIncome);

public record BalanceSheetDto(decimal TotalAssets, decimal TotalLiabilities, decimal TotalEquity, decimal RetainedEarnings);

public record CashFlowDto(decimal CashIn, decimal CashOut, decimal NetChange);

public record MonthlyTrendPointDto(string Month, decimal Revenue, decimal Expense, decimal NetIncome, decimal CashPosition);

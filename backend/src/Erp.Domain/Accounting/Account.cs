using Erp.Domain.Common;

namespace Erp.Domain.Accounting;

public enum AccountType { Asset, Liability, Equity, Revenue, Expense }

// The tenant's Chart of Accounts. Deliberately no delete — like JobTitle/Department,
// retiring one while journal lines still reference it would orphan those lines, so
// IsActive just hides it from new-entry pickers instead.
public class Account : TenantEntity
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public AccountType Type { get; set; }

    // ISO 4217 code. Defaults to the tenant's BaseCurrencyCode at creation, but a bank/wallet
    // account genuinely held in a foreign currency (a USD PayPal account, say) can be flagged
    // otherwise — every line posted to it then carries its own ExchangeRateToBase.
    public string Currency { get; set; } = default!;

    // Which Asset accounts represent actual cash/bank balances — drives the
    // "Bank / Cash" ledger view and the simplified Cash Flow report.
    public bool IsCashAccount { get; set; }
    public bool IsActive { get; set; } = true;
}

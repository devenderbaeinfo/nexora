using Nexora.Shared.Common;

namespace Nexora.Modules.Finance.Entities;

// Posted directly — no draft/approval stage. Accounting.PostEntries is already the gate;
// splitting "create" from "post" would need a whole second workflow this scope doesn't ask for.
// A JournalEntry's lines must balance (sum of Debit == sum of Credit) before it can be
// saved at all — enforced in AccountingController, not here, since that's a cross-row rule.
public class JournalEntry : TenantEntity
{
    public DateOnly EntryDate { get; set; }
    public string Memo { get; set; } = default!;
    public Guid PostedByUserId { get; set; }
}

public class JournalLine : TenantEntity
{
    public Guid JournalEntryId { get; set; }
    public Guid AccountId { get; set; }

    // Always in the account's OWN currency (Account.Currency) — a USD account's ledger reads
    // in USD. ExchangeRateToBase is the rate AT POSTING TIME (1 unit of the account's currency
    // = this many units of the tenant's base currency), locked in permanently so a later rate
    // change never rewrites a historical entry. An entry balances in BASE-currency terms
    // (Debit * ExchangeRateToBase == Credit * ExchangeRateToBase across all its lines), not
    // necessarily line-by-line in native currency — that's what lets a $20 USD line and a
    // ₹1,664 INR line belong to the same balanced entry.
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal ExchangeRateToBase { get; set; } = 1m;
}

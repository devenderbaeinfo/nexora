using Erp.Domain.Common;

namespace Erp.Domain.Accounting;

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
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

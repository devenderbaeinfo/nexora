using Erp.Domain.Common;

namespace Erp.Domain.Accounting;

// Manually maintained by Finance — no live FX feed integration (a separate, later decision).
// One row per (currency, effective date); posting a journal line looks up the most recent
// row on or before the entry date, so historical entries stay pinned to the rate that was
// actually in effect when the transaction happened, not whatever the rate is today.
public class ExchangeRate : TenantEntity
{
    public string CurrencyCode { get; set; } = default!;

    // 1 unit of CurrencyCode = this many units of the tenant's BaseCurrencyCode.
    public decimal RateToBase { get; set; }

    public DateOnly EffectiveDate { get; set; }
}

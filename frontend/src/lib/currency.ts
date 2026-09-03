// The tenant's base/reporting currency (ISO 4217, e.g. "INR"), set once at login — same
// module-level-singleton pattern as api.ts's access token, so every page can format money
// correctly without threading it through props or re-fetching it. Defaults to INR (this
// product's actual home currency) rather than a foreign default, so a page rendered before
// login resolves still shows something sensible instead of a wrong currency symbol.
let baseCurrencyCode = "INR";

export function setBaseCurrencyCode(code: string) {
  baseCurrencyCode = code || "INR";
}

export function getBaseCurrencyCode() {
  return baseCurrencyCode;
}

// Drop-in replacement for the old `n.toLocaleString(undefined, { style: "currency", currency:
// "USD" })` calls scattered across the app — those hardcoded USD regardless of the tenant's
// real currency. Pass an explicit `currency` only when formatting an amount that is genuinely
// denominated in a different currency (e.g. a foreign-currency journal line); otherwise it
// defaults to the tenant's own base currency.
export function formatCurrency(amount: number, options?: Intl.NumberFormatOptions & { currency?: string }): string {
  const { currency, ...rest } = options ?? {};
  return amount.toLocaleString(undefined, { style: "currency", currency: currency || baseCurrencyCode, ...rest });
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";
import { formatCurrency, getBaseCurrencyCode } from "../lib/currency";

interface AccountRow { id: string; code: string; name: string; currency: string; }
interface ExchangeRateRow { currencyCode: string; rateToBase: number; effectiveDate: string; }
interface JournalLineRow {
  accountId: string; accountName: string; currency: string;
  debit: number; credit: number; exchangeRateToBase: number; baseDebit: number; baseCredit: number;
}
interface JournalEntryRow { id: string; entryDate: string; memo: string; postedByName: string; lines: JournalLineRow[]; }

interface DraftLine { accountId: string; debit: string; credit: string; exchangeRateToBase: string }

export default function JournalEntries() {
  const { can } = useAuth();
  const canPost = can("accounting.post_entries");
  const queryClient = useQueryClient();
  const baseCurrency = getBaseCurrencyCode();

  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { accountId: "", debit: "", credit: "", exchangeRateToBase: "" },
    { accountId: "", debit: "", credit: "", exchangeRateToBase: "" },
  ]);

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<AccountRow[]>("/accounting/accounts")).data,
  });

  const rates = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => (await api.get<ExchangeRateRow[]>("/accounting/exchange-rates")).data,
  });

  const entries = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => (await api.get<JournalEntryRow[]>("/accounting/journal-entries")).data,
  });

  const accountById = (id: string) => accounts.data?.find((a) => a.id === id);

  // Mirrors the backend's own lookup (most recent rate on or before the entry date) purely so
  // the balance preview here matches what the server will actually resolve and post.
  const latestRateFor = (currencyCode: string) => {
    const candidates = (rates.data ?? []).filter((r) => r.currencyCode === currencyCode && r.effectiveDate <= entryDate);
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, r) => (r.effectiveDate > latest.effectiveDate ? r : latest));
  };

  const resolvedRate = (line: DraftLine): number | null => {
    const account = accountById(line.accountId);
    if (!account) return null;
    if (account.currency === baseCurrency) return 1;
    if (line.exchangeRateToBase) return Number(line.exchangeRateToBase);
    return latestRateFor(account.currency)?.rateToBase ?? null;
  };

  const lineBaseAmounts = lines.map((l) => {
    const rate = resolvedRate(l);
    if (rate === null) return { baseDebit: 0, baseCredit: 0, rate: null as number | null };
    return { baseDebit: Number(l.debit || 0) * rate, baseCredit: Number(l.credit || 0) * rate, rate };
  });

  const totalBaseDebit = lineBaseAmounts.reduce((sum, l) => sum + l.baseDebit, 0);
  const totalBaseCredit = lineBaseAmounts.reduce((sum, l) => sum + l.baseCredit, 0);
  const hasUnresolvedRate = lines.some((l, i) => l.accountId && lineBaseAmounts[i].rate === null);
  const balanced = !hasUnresolvedRate && Math.abs(totalBaseDebit - totalBaseCredit) < 0.01 && totalBaseDebit > 0;

  const post = useMutation({
    mutationFn: () => api.post("/accounting/journal-entries", {
      entryDate, memo,
      lines: lines.filter((l) => l.accountId).map((l) => ({
        accountId: l.accountId, debit: Number(l.debit || 0), credit: Number(l.credit || 0),
        exchangeRateToBase: l.exchangeRateToBase ? Number(l.exchangeRateToBase) : undefined,
      })),
    }),
    onSuccess: () => {
      setMemo("");
      setLines([{ accountId: "", debit: "", credit: "", exchangeRateToBase: "" }, { accountId: "", debit: "", credit: "", exchangeRateToBase: "" }]);
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
    },
  });

  const updateLine = (i: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Journal Entries</h1>
          <p style={s.subtitle}>
            Posted directly — an entry balances in {baseCurrency} across all lines, so a foreign-currency line
            (e.g. a USD subscription) and a {baseCurrency} line can belong to the same entry.
          </p>
        </div>
      </header>

      {canPost && (
        <section style={{ ...s.card, marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="date" style={s.input} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            <input style={{ ...s.input, flex: 1, minWidth: 200 }} placeholder="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          {lines.map((line, i) => {
            const account = accountById(line.accountId);
            const isForeign = !!account && account.currency !== baseCurrency;
            const rate = lineBaseAmounts[i].rate;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select style={{ ...s.select, flex: 1 }} value={line.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value, exchangeRateToBase: "" })}>
                    <option value="">Select account…</option>
                    {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.currency})</option>)}
                  </select>
                  <input
                    type="number" style={{ ...s.input, width: 110 }} placeholder="Debit" value={line.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
                  />
                  <input
                    type="number" style={{ ...s.input, width: 110 }} placeholder="Credit" value={line.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
                  />
                </div>
                {isForeign && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, paddingLeft: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>1 {account!.currency} =</span>
                    <input
                      type="number" step={0.0001} style={{ ...s.input, width: 100 }}
                      placeholder={latestRateFor(account!.currency)?.rateToBase.toString() ?? "rate"}
                      value={line.exchangeRateToBase}
                      onChange={(e) => updateLine(i, { exchangeRateToBase: e.target.value })}
                    />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {baseCurrency}
                      {rate === null && " — no rate configured for this date, add one under Exchange Rates"}
                      {rate !== null && (line.debit || line.credit) && (
                        <> · ≈ {formatCurrency((Number(line.debit || 0) || Number(line.credit || 0)) * rate)}</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          <button style={s.secondary} onClick={() => setLines((prev) => [...prev, { accountId: "", debit: "", credit: "", exchangeRateToBase: "" }])}>
            + Add line
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <span style={{ fontSize: 13, color: balanced ? "var(--good)" : "var(--muted)" }}>
              Debit {formatCurrency(totalBaseDebit)} / Credit {formatCurrency(totalBaseCredit)} {balanced ? "— balanced" : ""}
            </span>
            <button style={s.addButton} disabled={!balanced || !memo.trim() || post.isPending} onClick={() => post.mutate()}>
              Post entry
            </button>
          </div>
          {post.isError && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
              {(post.error as any)?.response?.data ?? "Couldn't post this entry."}
            </p>
          )}
        </section>
      )}

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Recent entries</h2>
        {entries.data?.map((entry) => (
          <div key={entry.id} style={{ ...s.card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{entry.memo}</span>
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{entry.entryDate} · posted by {entry.postedByName}</span>
            </div>
            <table style={s.table}>
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ ...s.td, border: "none", padding: "4px 0" }}>
                      {l.accountName}
                      {l.currency !== baseCurrency && (
                        <span style={{ color: "var(--faint)", fontSize: 11.5, marginLeft: 6 }}>
                          ({l.currency}{l.exchangeRateToBase !== 1 ? ` @ ${l.exchangeRateToBase}` : ""})
                        </span>
                      )}
                    </td>
                    <td style={{ ...s.td, border: "none", padding: "4px 0", textAlign: "right" }}>
                      {l.debit > 0 ? formatCurrency(l.debit, { currency: l.currency }) : ""}
                      {l.debit > 0 && l.currency !== baseCurrency && <div style={{ fontSize: 11, color: "var(--faint)" }}>{formatCurrency(l.baseDebit)}</div>}
                    </td>
                    <td style={{ ...s.td, border: "none", padding: "4px 0", textAlign: "right" }}>
                      {l.credit > 0 ? formatCurrency(l.credit, { currency: l.currency }) : ""}
                      {l.credit > 0 && l.currency !== baseCurrency && <div style={{ fontSize: 11, color: "var(--faint)" }}>{formatCurrency(l.baseCredit)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!entries.isLoading && (!entries.data || entries.data.length === 0) && <p style={s.muted}>No entries posted yet.</p>}
      </section>
    </div>
  );
}

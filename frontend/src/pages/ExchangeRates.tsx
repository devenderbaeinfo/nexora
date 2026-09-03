import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";
import { getBaseCurrencyCode } from "../lib/currency";
import Spinner from "../components/Spinner";

interface ExchangeRateRow {
  id: string;
  currencyCode: string;
  rateToBase: number;
  effectiveDate: string;
}

// Manually maintained — no live FX feed. Posting a journal line against a foreign-currency
// account looks up the most recent rate on or before the entry's date, so a rate added today
// only affects entries from today onward; historical entries stay pinned to whatever rate was
// actually in effect when they were posted.
export default function ExchangeRates() {
  const { can } = useAuth();
  const canManage = can("accounting.post_entries");
  const queryClient = useQueryClient();
  const baseCurrency = getBaseCurrencyCode();

  const [currencyCode, setCurrencyCode] = useState("USD");
  const [rateToBase, setRateToBase] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => (await api.get<ExchangeRateRow[]>("/accounting/exchange-rates")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/accounting/exchange-rates", {
      currencyCode: currencyCode.trim().toUpperCase(), rateToBase: Number(rateToBase), effectiveDate,
    }),
    onSuccess: () => {
      setRateToBase("");
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Exchange Rates</h1>
          <p style={s.subtitle}>
            1 unit of a foreign currency = this many units of {baseCurrency}. Used whenever a journal entry posts
            against a foreign-currency account without an explicit rate — the most recent rate on or before the
            entry's date applies.
          </p>
        </div>
      </header>

      {canManage && (
        <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...s.input, width: 70 }} placeholder="USD" maxLength={3}
            value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
          />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>1 unit =</span>
          <input
            type="number" min={0} step={0.0001} style={{ ...s.input, width: 110 }} placeholder="Rate"
            value={rateToBase} onChange={(e) => setRateToBase(e.target.value)}
          />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{baseCurrency}, effective</span>
          <input type="date" style={s.input} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <button style={s.addButton} disabled={!currencyCode.trim() || !rateToBase || create.isPending} onClick={() => create.mutate()}>
            Add rate
          </button>
        </section>
      )}

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't add this rate."}
        </p>
      )}

      {isLoading && <Spinner />}
      {data && data.length === 0 && <p style={s.muted}>No exchange rates configured yet — add one above before posting against a foreign-currency account.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Currency</th>
                <th style={s.th}>Rate to {baseCurrency}</th>
                <th style={s.th}>Effective from</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td style={s.td}>{r.currencyCode}</td>
                  <td style={s.td}>{r.rateToBase}</td>
                  <td style={s.td}>{r.effectiveDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

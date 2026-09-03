import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface BalanceSheetData {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number;
}

export default function BalanceSheet() {
  const [asOf, setAsOf] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["balance-sheet", asOf],
    queryFn: async () => (await api.get<BalanceSheetData>("/accounting/balance-sheet", { params: { asOf: asOf || undefined } })).data,
  });

  const currency = formatCurrency;
  const balances = data ? Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) < 0.01 : true;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Balance Sheet</h1>
          <p style={s.subtitle}>Assets = Liabilities + Equity. Equity includes retained earnings not yet formally closed out.</p>
        </div>
        <input type="date" style={s.input} value={asOf} onChange={(e) => setAsOf(e.target.value)} placeholder="As of" />
      </header>

      {isLoading && <Spinner />}

      {data && (
        <>
          <div style={s.statGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Total Assets</div>
              <div style={s.statValue}>{currency(data.totalAssets)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Total Liabilities</div>
              <div style={s.statValue}>{currency(data.totalLiabilities)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Total Equity (incl. retained earnings)</div>
              <div style={s.statValue}>{currency(data.totalEquity)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Retained Earnings</div>
              <div style={s.statValue}>{currency(data.retainedEarnings)}</div>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 12.5, color: balances ? "var(--good)" : "var(--danger)" }}>
            {balances ? "Balanced." : "Doesn't balance — check recent journal entries."}
          </p>
        </>
      )}
    </div>
  );
}

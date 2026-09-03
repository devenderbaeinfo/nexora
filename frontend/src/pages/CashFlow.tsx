import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface CashFlowData {
  cashIn: number;
  cashOut: number;
  netChange: number;
}

export default function CashFlow() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cash-flow", from, to],
    queryFn: async () => (await api.get<CashFlowData>("/accounting/cash-flow", { params: { from: from || undefined, to: to || undefined } })).data,
  });

  const currency = formatCurrency;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Cash Flow</h1>
          <p style={s.subtitle}>Net movement through accounts marked as cash/bank — a simplified view, not split into operating/investing/financing.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" style={s.input} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <input type="date" style={s.input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        </div>
      </header>

      {isLoading && <Spinner />}

      {data && (
        <div style={s.statGrid}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Cash In</div>
            <div style={s.statValue}>{currency(data.cashIn)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Cash Out</div>
            <div style={s.statValue}>{currency(data.cashOut)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Net Change</div>
            <div style={{ ...s.statValue, color: data.netChange >= 0 ? "var(--good)" : "var(--danger)" }}>
              {currency(data.netChange)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface ProfitAndLoss {
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
}

export default function ProfitAndLoss() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["profit-and-loss", from, to],
    queryFn: async () => (await api.get<ProfitAndLoss>("/accounting/profit-and-loss", { params: { from: from || undefined, to: to || undefined } })).data,
  });

  const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Profit & Loss</h1>
          <p style={s.subtitle}>Revenue minus expense for a period, computed from posted journal entries.</p>
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
            <div style={s.statLabel}>Revenue</div>
            <div style={s.statValue}>{currency(data.totalRevenue)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Expense</div>
            <div style={s.statValue}>{currency(data.totalExpense)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Net Income</div>
            <div style={{ ...s.statValue, color: data.netIncome >= 0 ? "var(--good)" : "var(--danger)" }}>
              {currency(data.netIncome)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

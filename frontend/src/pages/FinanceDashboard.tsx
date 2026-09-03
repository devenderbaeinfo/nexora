import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import TrendChart from "../components/TrendChart";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface ReimbursementRow { id: string; }
interface ProjectExpenseRow { id: string; }
interface ProfitAndLoss { totalRevenue: number; totalExpense: number; netIncome: number; }
interface MonthlyTrendPoint { month: string; revenue: number; expense: number; netIncome: number; cashPosition: number; }

export default function FinanceDashboard() {
  const pendingReimbursements = useQuery({
    queryKey: ["reimbursements", "pendingFinance"],
    queryFn: async () => (await api.get<ReimbursementRow[]>("/reimbursements/pending-finance-approval")).data,
  });

  const pendingProjectExpenses = useQuery({
    queryKey: ["project-expenses", "pendingFinance"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>("/project-expenses/pending-finance-approval")).data,
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  const from = monthStart.toISOString().slice(0, 10);

  const pnl = useQuery({
    queryKey: ["profit-and-loss", "month"],
    queryFn: async () => (await api.get<ProfitAndLoss>("/accounting/profit-and-loss", { params: { from } })).data,
  });

  const trend = useQuery({
    queryKey: ["accounting", "monthly-trend"],
    queryFn: async () => (await api.get<MonthlyTrendPoint[]>("/accounting/monthly-trend")).data,
  });

  const currency = formatCurrency;
  const currencyCompact = (n: number) => formatCurrency(n, { notation: "compact" });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Finance Dashboard</h1>
          <p style={s.subtitle}>What's waiting on you and how the month is looking so far.</p>
        </div>
      </header>

      <div style={s.statGrid}>
        <Link to="/expenses/approvals" style={{ textDecoration: "none" }}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending reimbursements</div>
            <div style={s.statValue}>{pendingReimbursements.data?.length ?? "—"}</div>
          </div>
        </Link>
        <Link to="/expenses/approvals" style={{ textDecoration: "none" }}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending project expenses</div>
            <div style={s.statValue}>{pendingProjectExpenses.data?.length ?? "—"}</div>
          </div>
        </Link>
        <Link to="/accounting/profit-and-loss" style={{ textDecoration: "none" }}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Net income (this month)</div>
            <div style={{ ...s.statValue, color: (pnl.data?.netIncome ?? 0) >= 0 ? "var(--good)" : "var(--danger)" }}>
              {pnl.data ? currency(pnl.data.netIncome) : "—"}
            </div>
          </div>
        </Link>
        <Link to="/accounting/trial-balance" style={{ textDecoration: "none" }}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Trial Balance</div>
            <div style={{ ...s.statValue, fontSize: 15 }}>Check now →</div>
          </div>
        </Link>
      </div>

      {(pendingReimbursements.error || pendingProjectExpenses.error || pnl.error || trend.error) && (
        <p style={{ color: "var(--danger)", marginTop: 20 }}>Some of this dashboard couldn't load. Try refreshing.</p>
      )}

      {trend.isLoading && <Spinner />}

      {trend.data && trend.data.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginTop: 28, alignItems: "start" }}>
          <section style={s.card}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Revenue vs. Expense</h2>
            <p style={{ ...s.muted, marginBottom: 16 }}>Last 6 months, by posting month.</p>
            <TrendChart
              labels={trend.data.map((p) => p.month)}
              series={[
                { name: "Revenue", color: "var(--accent)", values: trend.data.map((p) => p.revenue) },
                { name: "Expense", color: "var(--teal)", values: trend.data.map((p) => p.expense) },
              ]}
              formatValue={currencyCompact}
            />
          </section>

          <section style={s.card}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Cash position</h2>
            <p style={{ ...s.muted, marginBottom: 16 }}>Cumulative balance across cash accounts.</p>
            <TrendChart
              labels={trend.data.map((p) => p.month)}
              series={[{ name: "Cash", color: "var(--accent)", values: trend.data.map((p) => p.cashPosition) }]}
              formatValue={currencyCompact}
              fillArea
            />
          </section>
        </div>
      )}
    </div>
  );
}

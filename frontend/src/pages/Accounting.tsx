import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";
import { pageStyles as s } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface ProfitAndLoss { netIncome: number }
interface BalanceSheetData { totalAssets: number }
interface CashFlowData { netChange: number }

const SECTIONS = [
  { to: "/accounting/chart-of-accounts", label: "Chart of Accounts", description: "Every account the ledger posts against." },
  { to: "/accounting/exchange-rates", label: "Exchange Rates", description: "Rates for posting foreign-currency accounts." },
  { to: "/accounting/journal-entries", label: "Journal Entries", description: "Every posted transaction, balanced and immutable." },
  { to: "/accounting/ledger", label: "General Ledger", description: "Full transaction history per account." },
  { to: "/accounting/bank-cash", label: "Bank & Cash", description: "Ledger filtered to cash accounts only." },
  { to: "/accounting/trial-balance", label: "Trial Balance", description: "Debit/credit totals across every account." },
  { to: "/accounting/profit-and-loss", label: "Profit & Loss", description: "Revenue and expenses over a period." },
  { to: "/accounting/balance-sheet", label: "Balance Sheet", description: "Assets, liabilities, and equity as of a date." },
  { to: "/accounting/cash-flow", label: "Cash Flow", description: "Cash in and out across a period." },
  { to: "/vendor-bills", label: "Vendor Bills", description: "Accounts Payable — vendors, bills, and payments.", permission: "accounts_payable.view" },
];

const currency = formatCurrency;

export default function Accounting() {
  const { can } = useAuth();

  const pnl = useQuery({
    queryKey: ["accounting", "profit-and-loss", "overview"],
    queryFn: async () => (await api.get<ProfitAndLoss>("/accounting/profit-and-loss")).data,
  });
  const balanceSheet = useQuery({
    queryKey: ["accounting", "balance-sheet", "overview"],
    queryFn: async () => (await api.get<BalanceSheetData>("/accounting/balance-sheet")).data,
  });
  const cashFlow = useQuery({
    queryKey: ["accounting", "cash-flow", "overview"],
    queryFn: async () => (await api.get<CashFlowData>("/accounting/cash-flow")).data,
  });

  const isLoading = pnl.isFetching || balanceSheet.isFetching || cashFlow.isFetching;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Accounting</h1>
          <p style={s.subtitle}>The books — chart of accounts, journal entries, ledger, and statements.</p>
        </div>
      </header>

      {isLoading && <Spinner />}

      <div style={s.statGrid}>
        {pnl.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Net income (all time)</div>
            <div style={{ ...s.statValue, color: pnl.data.netIncome >= 0 ? "var(--good)" : "var(--danger)" }}>
              {currency(pnl.data.netIncome)}
            </div>
          </div>
        )}
        {balanceSheet.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Total assets</div>
            <div style={s.statValue}>{currency(balanceSheet.data.totalAssets)}</div>
          </div>
        )}
        {cashFlow.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Cash position (all time)</div>
            <div style={{ ...s.statValue, color: cashFlow.data.netChange >= 0 ? "var(--good)" : "var(--danger)" }}>
              {currency(cashFlow.data.netChange)}
            </div>
          </div>
        )}
      </div>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Quick actions</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {can("accounting.post_entries") && <Link to="/accounting/journal-entries" style={linkButton}>+ Post journal entry</Link>}
          {can("accounting.run_reimbursement") && <Link to="/reimbursement" style={linkButtonSecondary}>Run reimbursement</Link>}
          <Link to="/accounting/trial-balance" style={linkButtonSecondary}>Trial balance</Link>
        </div>
      </section>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Books & statements</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {SECTIONS.filter((section) => !section.permission || can(section.permission)).map((section) => (
            <Link key={section.to} to={section.to} style={cardLink} className="card-surface">
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>{section.label}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{section.description}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const cardLink: React.CSSProperties = {
  textDecoration: "none", display: "block", background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
  padding: 16, boxShadow: "var(--shadow)",
};

const linkButton: React.CSSProperties = {
  textDecoration: "none", background: "var(--accent)", color: "var(--accent-ink)",
  fontWeight: 700, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--radius)",
};

const linkButtonSecondary: React.CSSProperties = {
  textDecoration: "none", background: "var(--surface-sunken)", color: "var(--ink)",
  fontWeight: 600, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
};

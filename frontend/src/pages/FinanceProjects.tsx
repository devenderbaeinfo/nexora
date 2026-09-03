import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s, tag, progressFill } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface ProjectRow {
  id: string;
  name: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  budgetAmount: number | null;
}

interface ProjectBudgetData {
  budgetAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  remaining: number;
  percentSpent: number;
}

interface ProjectExpenseRow {
  id: string;
  employeeName: string;
  amount: number;
  category: string;
  incurredOn: string;
  status: string;
}

interface MonthPoint { label: string; revenue: number; cost: number; }

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), h | 1) ^ 0) >>> 0;
    return ((h ^ (h >>> 7)) >>> 0) / 4294967296;
  };
}

function buildDummySeries(projectId: string, budget: number): MonthPoint[] {
  const rand = seededRandom(projectId);
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const monthlyBaseline = Math.max(budget / 12, 1000);
  return months.map((label) => {
    const revenue = Math.round(monthlyBaseline * (0.85 + rand() * 0.3));
    const cost = Math.round(revenue * (0.6 + rand() * 0.35));
    return { label, revenue, cost };
  });
}

const currency = formatCurrency;

// Finance's one-stop project view: pick a project from the list right here (no separate
// picker control) and see budget, itemized cost, and a profitability preview together —
// replacing three pages that each made you re-select the same project.
export default function FinanceProjects() {
  const [projectId, setProjectId] = useState<string | null>(null);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectRow[]>("/projects")).data,
  });

  const selected = projects.data?.find((p) => p.id === projectId) ?? null;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Projects</h1>
          <p style={s.subtitle}>Every project. Pick one to see its budget, cost, and profitability together.</p>
        </div>
      </header>

      {projects.isLoading && <Spinner />}
      {!projects.isLoading && (!projects.data || projects.data.length === 0) && <p style={s.muted}>No projects yet.</p>}

      {projects.data && projects.data.length > 0 && (
        <div style={cardGrid}>
          {projects.data.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className="card-surface"
              style={{ ...projectCard, ...(p.id === projectId ? projectCardActive : {}) }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>{p.name}</div>
                <span style={tag(p.status === "Active" ? "var(--good-soft)" : "var(--surface-sunken)", p.status === "Active" ? "var(--good)" : "var(--faint)")}>
                  {p.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{p.customerName}</div>
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>PM: {p.projectManagerName}</div>
              {p.budgetAmount !== null && (
                <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 10, fontWeight: 600 }}>
                  {currency(p.budgetAmount)} budget
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && <FinanceProjectDetail key={selected.id} project={selected} onClose={() => setProjectId(null)} />}
    </div>
  );
}

function FinanceProjectDetail({ project, onClose }: { project: ProjectRow; onClose: () => void }) {
  const budget = useQuery({
    queryKey: ["projects", project.id, "budget"],
    queryFn: async () => (await api.get<ProjectBudgetData>(`/projects/${project.id}/budget`)).data,
  });

  const expenses = useQuery({
    queryKey: ["projects", project.id, "expenses"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>(`/projects/${project.id}/expenses`)).data,
  });

  const series = useMemo(() => buildDummySeries(project.id, project.budgetAmount ?? 0), [project.id, project.budgetAmount]);
  const maxValue = Math.max(1, ...series.flatMap((p) => [p.revenue, p.cost]));
  const totalRevenue = series.reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = series.reduce((sum, p) => sum + p.cost, 0);
  const margin = totalRevenue - totalCost;
  const marginPercent = totalRevenue === 0 ? 0 : Math.round((margin / totalRevenue) * 100);

  const approvedCost = expenses.data?.filter((e) => e.status === "Approved").reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-display)" }}>{project.name}</h2>
        <button style={s.secondary} onClick={onClose}>Close</button>
      </div>

      {budget.data && (
        <>
          <div style={{ ...s.statGrid, marginBottom: 20 }}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Budget</div>
              <div style={s.statValue}>{currency(budget.data.budgetAmount)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Approved spend</div>
              <div style={s.statValue}>{currency(budget.data.approvedSpend)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Pending spend</div>
              <div style={s.statValue}>{currency(budget.data.pendingSpend)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Remaining</div>
              <div style={s.statValue}>{currency(budget.data.remaining)}</div>
            </div>
          </div>
          <div style={{ ...s.card, marginBottom: 28 }}>
            <div style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Committed (approved + pending)</span>
              <span style={s.muted}>{budget.data.percentSpent}% of budget</span>
            </div>
            <div style={s.progressTrack}>
              <div style={progressFill(budget.data.percentSpent, budget.data.percentSpent > 90)} />
            </div>
          </div>
        </>
      )}

      <section style={{ ...s.section, marginBottom: 28 }}>
        <h3 style={s.sectionTitle}>Cost — itemized expenses</h3>
        <div style={{ ...s.statCard, maxWidth: 220, marginBottom: 14 }}>
          <div style={s.statLabel}>Approved cost</div>
          <div style={s.statValue}>{currency(approvedCost)}</div>
        </div>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Employee</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Incurred</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!expenses.data || expenses.data.length === 0) && (
                <tr><td style={s.td} colSpan={5}>No expenses logged for this project.</td></tr>
              )}
              {expenses.data?.map((e) => (
                <tr key={e.id}>
                  <td style={s.td}>{e.employeeName}</td>
                  <td style={s.td}>{e.category}</td>
                  <td style={s.td}>{currency(e.amount)}</td>
                  <td style={s.td}>{e.incurredOn}</td>
                  <td style={s.td}><ExpenseStatusTag status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={s.section}>
        <h3 style={s.sectionTitle}>Profitability preview</h3>
        <p style={{ ...s.muted, marginBottom: 12 }}>Illustrative — not wired to a real billing/contract-value model yet.</p>
        <div style={s.statGrid}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Revenue (6 mo.)</div>
            <div style={s.statValue}>{currency(totalRevenue)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Cost (6 mo.)</div>
            <div style={s.statValue}>{currency(totalCost)}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Margin</div>
            <div style={{ ...s.statValue, color: margin >= 0 ? "var(--good)" : "var(--danger)" }}>
              {currency(margin)} ({marginPercent}%)
            </div>
          </div>
        </div>

        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12, fontSize: 12.5 }}>
            <LegendSwatch color="var(--accent)" label="Revenue" />
            <LegendSwatch color="var(--teal)" label="Cost" />
          </div>
          <svg viewBox="0 0 480 224" width="100%" role="img" aria-label="Revenue vs cost by month">
            {series.map((point, i) => {
              const groupWidth = 480 / 6;
              const groupX = i * groupWidth;
              const revenueHeight = (point.revenue / maxValue) * 200;
              const costHeight = (point.cost / maxValue) * 200;
              const barWidth = groupWidth * 0.28;
              const gap = 4;
              return (
                <g key={point.label}>
                  <rect x={groupX + groupWidth / 2 - barWidth - gap / 2} y={200 - revenueHeight} width={barWidth} height={revenueHeight} rx={4} fill="var(--accent)">
                    <title>{`${point.label} revenue: ${currency(point.revenue)}`}</title>
                  </rect>
                  <rect x={groupX + groupWidth / 2 + gap / 2} y={200 - costHeight} width={barWidth} height={costHeight} rx={4} fill="var(--teal)">
                    <title>{`${point.label} cost: ${currency(point.cost)}`}</title>
                  </rect>
                  <text x={groupX + groupWidth / 2} y={218} textAnchor="middle" fontSize="11" fill="var(--muted)">{point.label}</text>
                </g>
              );
            })}
            <line x1={0} y1={200} x2={480} y2={200} stroke="var(--border)" strokeWidth={1} />
          </svg>
        </div>
      </section>
    </div>
  );
}

function ExpenseStatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Approved: ["var(--good-soft)", "var(--good)"],
    ManagerApproved: ["var(--warn-soft)", "var(--warn)"],
    Pending: ["var(--warn-soft)", "var(--warn)"],
    Rejected: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={tag(bg, fg)}>{status}</span>;
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

const cardGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14,
};
const projectCard: React.CSSProperties = {
  textAlign: "left", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)", font: "inherit",
};
const projectCardActive: React.CSSProperties = {
  borderColor: "var(--accent)", boxShadow: "var(--glow-accent), var(--shadow)",
};

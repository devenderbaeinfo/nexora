import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/Spinner";
import { pageStyles as s, tag, projectCardGrid, projectCard, projectCardActive } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface ProjectRow {
  id: string;
  name: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  budgetAmount: number | null;
}

interface MonthPoint {
  label: string;
  revenue: number;
  cost: number;
}

interface Financials {
  laborCost: number;
  laborRevenue: number;
  expenseCost: number;
  expenseRevenue: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  marginPercent: number;
  monthly: MonthPoint[];
}

const CHART_HEIGHT = 200;
const CHART_WIDTH = 480;

export default function ProjectProfitability() {
  const [projectId, setProjectId] = useState<string | null>(null);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectRow[]>("/projects")).data,
  });

  const selected = (projects.data ?? []).find((p) => p.id === projectId) ?? null;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Profitability</h1>
          <p style={s.subtitle}>Pick a project to see revenue vs. cost by month, from approved timesheet hours and approved project expenses priced at each member's project rates.</p>
        </div>
      </header>

      {projects.isLoading && <Spinner />}
      {!projects.isLoading && (projects.data ?? []).length === 0 && <p style={s.muted}>No projects to show yet.</p>}

      {(projects.data ?? []).length > 0 && (
        <div style={projectCardGrid}>
          {projects.data!.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className="card-surface"
              style={{ ...projectCard, ...(p.id === projectId ? projectCardActive : {}) }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>{p.name}</div>
                <span style={tag(p.status === "Active" ? "var(--good-soft)" : "var(--warn-soft)", p.status === "Active" ? "var(--good)" : "var(--warn)")}>
                  {p.status === "OnHold" ? "On hold" : p.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{p.customerName}</div>
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>PM: {p.projectManagerName}</div>
            </button>
          ))}
        </div>
      )}

      {selected && <ProfitabilityDetail key={selected.id} project={selected} onClose={() => setProjectId(null)} />}
    </div>
  );
}

function ProfitabilityDetail({ project, onClose }: { project: ProjectRow; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["projects", project.id, "financials"],
    queryFn: async () => (await api.get<Financials>(`/projects/${project.id}/financials`)).data,
  });

  const series = data?.monthly ?? [];
  const maxValue = Math.max(1, ...series.flatMap((p) => [p.revenue, p.cost]));
  const groupWidth = CHART_WIDTH / Math.max(series.length, 1);

  const currency = (n: number) => formatCurrency(n, { maximumFractionDigits: 0 });

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-display)" }}>{project.name}</h2>
        <button style={s.secondary} onClick={onClose}>Close</button>
      </div>

      {isLoading && <Spinner />}

      {data && (
        <>
          <div style={s.statGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Revenue</div>
              <div style={s.statValue}>{currency(data.totalRevenue)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Cost</div>
              <div style={s.statValue}>{currency(data.totalCost)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Profit</div>
              <div style={{ ...s.statValue, color: data.profit >= 0 ? "var(--good)" : "var(--danger)" }}>
                {currency(data.profit)} ({data.marginPercent}%)
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={tag("var(--surface-sunken)", "var(--muted)")}>Labor cost {currency(data.laborCost)}</span>
            <span style={tag("var(--surface-sunken)", "var(--muted)")}>Labor revenue {currency(data.laborRevenue)}</span>
            <span style={tag("var(--surface-sunken)", "var(--muted)")}>Expense cost {currency(data.expenseCost)}</span>
            <span style={tag("var(--surface-sunken)", "var(--muted)")}>Billable expense revenue {currency(data.expenseRevenue)}</span>
          </div>

          <section style={{ ...s.section, marginTop: 24 }}>
            <h2 style={s.sectionTitle}>Revenue vs. cost by month</h2>
            <div style={s.card}>
              {series.length === 0 && (
                <p style={s.muted}>No approved timesheet hours or approved expenses yet — nothing to chart.</p>
              )}
              {series.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12, fontSize: 12.5 }}>
                    <LegendSwatch color="var(--accent)" label="Revenue" />
                    <LegendSwatch color="var(--teal)" label="Cost" />
                  </div>
                  <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`} width="100%" role="img" aria-label="Revenue vs cost by month">
                    {series.map((point, i) => {
                      const groupX = i * groupWidth;
                      const revenueHeight = (point.revenue / maxValue) * CHART_HEIGHT;
                      const costHeight = (point.cost / maxValue) * CHART_HEIGHT;
                      const barWidth = groupWidth * 0.28;
                      const gap = 4;
                      return (
                        <g key={point.label}>
                          <rect
                            x={groupX + groupWidth / 2 - barWidth - gap / 2}
                            y={CHART_HEIGHT - revenueHeight}
                            width={barWidth} height={revenueHeight}
                            rx={4} fill="var(--accent)"
                          >
                            <title>{`${point.label} revenue: ${currency(point.revenue)}`}</title>
                          </rect>
                          <rect
                            x={groupX + groupWidth / 2 + gap / 2}
                            y={CHART_HEIGHT - costHeight}
                            width={barWidth} height={costHeight}
                            rx={4} fill="var(--teal)"
                          >
                            <title>{`${point.label} cost: ${currency(point.cost)}`}</title>
                          </rect>
                          <text
                            x={groupX + groupWidth / 2} y={CHART_HEIGHT + 18}
                            textAnchor="middle" fontSize="11" fill="var(--muted)"
                          >
                            {point.label}
                          </text>
                        </g>
                      );
                    })}
                    <line x1={0} y1={CHART_HEIGHT} x2={CHART_WIDTH} y2={CHART_HEIGHT} stroke="var(--border)" strokeWidth={1} />
                  </svg>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

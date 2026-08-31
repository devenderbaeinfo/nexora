import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import ProjectPicker from "../components/ProjectPicker";
import { pageStyles as s, tag } from "../styles/pageKit";

interface ProjectDetail {
  id: string;
  name: string;
  budgetAmount: number;
}

interface MonthPoint {
  label: string;
  revenue: number;
  cost: number;
}

// Deterministic pseudo-random generator seeded from the project id, so the illustrative
// numbers below stay stable across reloads instead of jumping around on every render.
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

const CHART_HEIGHT = 200;
const CHART_WIDTH = 480;
const BAR_GROUP_WIDTH = CHART_WIDTH / 6;

export default function ProjectProfitability() {
  const [projectId, setProjectId] = useState("");

  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  const series = useMemo(
    () => (project ? buildDummySeries(project.id, project.budgetAmount) : []),
    [project]
  );

  const maxValue = Math.max(1, ...series.flatMap((p) => [p.revenue, p.cost]));
  const totalRevenue = series.reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = series.reduce((sum, p) => sum + p.cost, 0);
  const margin = totalRevenue - totalCost;
  const marginPercent = totalRevenue === 0 ? 0 : Math.round((margin / totalRevenue) * 100);

  const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Profitability</h1>
          <p style={s.subtitle}>Revenue vs. cost by month. There's no billing/contract-value model yet, so these numbers are illustrative.</p>
        </div>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </header>

      {!projectId && <p style={s.muted}>Select a project to see its profitability preview.</p>}

      {project && (
        <>
          <div style={{ marginBottom: 16 }}>
            <span style={tag("var(--warn-soft)", "var(--warn)")}>Preview data — illustrative, not wired to real billing</span>
          </div>

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

          <section style={{ ...s.section, marginTop: 24 }}>
            <h2 style={s.sectionTitle}>Revenue vs. cost by month</h2>
            <div style={s.card}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12, fontSize: 12.5 }}>
                <LegendSwatch color="var(--accent)" label="Revenue" />
                <LegendSwatch color="var(--teal)" label="Cost" />
              </div>
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`} width="100%" role="img" aria-label="Revenue vs cost by month">
                {series.map((point, i) => {
                  const groupX = i * BAR_GROUP_WIDTH;
                  const revenueHeight = (point.revenue / maxValue) * CHART_HEIGHT;
                  const costHeight = (point.cost / maxValue) * CHART_HEIGHT;
                  const barWidth = BAR_GROUP_WIDTH * 0.28;
                  const gap = 4;
                  return (
                    <g key={point.label}>
                      <rect
                        x={groupX + BAR_GROUP_WIDTH / 2 - barWidth - gap / 2}
                        y={CHART_HEIGHT - revenueHeight}
                        width={barWidth} height={revenueHeight}
                        rx={4} fill="var(--accent)"
                      >
                        <title>{`${point.label} revenue: ${currency(point.revenue)}`}</title>
                      </rect>
                      <rect
                        x={groupX + BAR_GROUP_WIDTH / 2 + gap / 2}
                        y={CHART_HEIGHT - costHeight}
                        width={barWidth} height={costHeight}
                        rx={4} fill="var(--teal)"
                      >
                        <title>{`${point.label} cost: ${currency(point.cost)}`}</title>
                      </rect>
                      <text
                        x={groupX + BAR_GROUP_WIDTH / 2} y={CHART_HEIGHT + 18}
                        textAnchor="middle" fontSize="11" fill="var(--muted)"
                      >
                        {point.label}
                      </text>
                    </g>
                  );
                })}
                <line x1={0} y1={CHART_HEIGHT} x2={CHART_WIDTH} y2={CHART_HEIGHT} stroke="var(--border)" strokeWidth={1} />
              </svg>
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

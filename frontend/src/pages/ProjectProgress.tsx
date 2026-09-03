import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/Spinner";
import { pageStyles as s, tag, progressFill, projectCardGrid, projectCard, projectCardActive } from "../styles/pageKit";

interface ProjectRow {
  id: string;
  name: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  budgetAmount: number | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  budgetAmount: number | null;
}

interface ProjectBudget {
  budgetAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  remaining: number;
  percentSpent: number;
}

export default function ProjectProgress() {
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
          <h1 style={s.title}>Project Progress</h1>
          <p style={s.subtitle}>Pick a project to see its time elapsed and budget burn.</p>
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

      {selected && <ProgressDetail key={selected.id} projectId={selected.id} onClose={() => setProjectId(null)} />}
    </div>
  );
}

function ProgressDetail({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
  });

  const budget = useQuery({
    queryKey: ["projects", projectId, "budget"],
    queryFn: async () => (await api.get<ProjectBudget>(`/projects/${projectId}/budget`)).data,
  });

  const percentTimeElapsed = (() => {
    if (!detail.data?.endDate) return null;
    const start = new Date(detail.data.startDate).getTime();
    const end = new Date(detail.data.endDate).getTime();
    const now = Date.now();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  })();

  return (
    <div style={{ marginTop: 28 }}>
      {detail.data && budget.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{detail.data.name}</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={s.muted}>{detail.data.status}</span>
                <button style={s.secondary} onClick={onClose}>Close</button>
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Time elapsed</span>
              <span style={s.muted}>{percentTimeElapsed === null ? "No end date set" : `${percentTimeElapsed.toFixed(0)}%`}</span>
            </div>
            {percentTimeElapsed !== null && (
              <div style={s.progressTrack}><div style={progressFill(percentTimeElapsed)} /></div>
            )}
          </div>

          <div style={s.card}>
            <div style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Budget spent</span>
              <span style={s.muted}>{budget.data.percentSpent}%</span>
            </div>
            <div style={s.progressTrack}>
              <div style={progressFill(budget.data.percentSpent, budget.data.percentSpent > 90)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

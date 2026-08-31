import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import ProjectPicker from "../components/ProjectPicker";
import { pageStyles as s, progressFill } from "../styles/pageKit";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  budgetAmount: number;
}

interface ProjectBudget {
  budgetAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  remaining: number;
  percentSpent: number;
}

export default function ProjectProgress() {
  const [projectId, setProjectId] = useState("");

  const detail = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  const budget = useQuery({
    queryKey: ["projects", projectId, "budget"],
    queryFn: async () => (await api.get<ProjectBudget>(`/projects/${projectId}/budget`)).data,
    enabled: !!projectId,
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
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Project Progress</h1>
          <p style={s.subtitle}>Time elapsed and budget burn as a proxy for how far along a project is.</p>
        </div>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </header>

      {!projectId && <p style={s.muted}>Select a project to see its progress.</p>}

      {detail.data && budget.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{detail.data.name}</span>
              <span style={s.muted}>{detail.data.status}</span>
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

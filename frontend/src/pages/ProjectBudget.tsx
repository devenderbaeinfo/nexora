import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import ProjectPicker from "../components/ProjectPicker";
import { pageStyles as s, progressFill } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface ProjectBudgetData {
  budgetAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  remaining: number;
  percentSpent: number;
}

export default function ProjectBudget() {
  const [projectId, setProjectId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects", projectId, "budget"],
    queryFn: async () => (await api.get<ProjectBudgetData>(`/projects/${projectId}/budget`)).data,
    enabled: !!projectId,
  });

  const currency = formatCurrency;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Project Budget</h1>
          <p style={s.subtitle}>Approved and pending spend against a project's budget.</p>
        </div>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </header>

      {!projectId && <p style={s.muted}>Select a project to see its budget.</p>}
      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load this project's budget. Try refreshing.</p>}

      {data && (
        <div style={{ maxWidth: 520 }}>
          <div style={s.statGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Budget</div>
              <div style={s.statValue}>{currency(data.budgetAmount)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Approved spend</div>
              <div style={s.statValue}>{currency(data.approvedSpend)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Pending spend</div>
              <div style={s.statValue}>{currency(data.pendingSpend)}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Remaining</div>
              <div style={s.statValue}>{currency(data.remaining)}</div>
            </div>
          </div>

          <div style={{ ...s.card, marginTop: 20 }}>
            <div style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Committed (approved + pending)</span>
              <span style={s.muted}>{data.percentSpent}% of budget</span>
            </div>
            <div style={s.progressTrack}>
              <div style={progressFill(data.percentSpent, data.percentSpent > 90)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ProjectPicker from "../components/ProjectPicker";
import { pageStyles as s } from "../styles/pageKit";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  budgetAmount: number;
}

const STATUSES = ["Active", "OnHold", "Completed", "Cancelled"];

export default function ProjectPlanning() {
  const { can } = useAuth();
  const canManage = can("project.manage_budget");
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("Active");

  const { data } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data) {
      setStartDate(data.startDate);
      setEndDate(data.endDate ?? "");
      setStatus(data.status);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.patch(`/projects/${projectId}`, { startDate, endDate: endDate || null, status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId] }),
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Project Planning</h1>
          <p style={s.subtitle}>Timeline and status for a project.</p>
        </div>
        <ProjectPicker value={projectId} onChange={(id) => { setProjectId(id); setStartDate(""); }} />
      </header>

      {!projectId && <p style={s.muted}>Select a project to view or edit its plan.</p>}

      {data && (
        <div style={{ ...s.card, maxWidth: 420 }}>
          <h2 style={s.sectionTitle}>{data.name}</h2>
          <label style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Start date</label>
          <input
            type="date" style={{ ...s.input, width: "100%", marginBottom: 12 }}
            value={startDate} disabled={!canManage}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <label style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>End date</label>
          <input
            type="date" style={{ ...s.input, width: "100%", marginBottom: 12 }}
            value={endDate} disabled={!canManage}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <label style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Status</label>
          <select
            style={{ ...s.select, width: "100%", marginBottom: 16 }}
            value={status} disabled={!canManage}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          {canManage && (
            <button style={s.addButton} disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}

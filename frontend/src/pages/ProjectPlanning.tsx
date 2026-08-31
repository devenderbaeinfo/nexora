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

interface Milestone {
  id: string;
  projectId: string;
  name: string;
  dueDate: string | null;
  status: string;
}

const STATUSES = ["Active", "OnHold", "Completed", "Cancelled"];
const MILESTONE_STATUSES = ["Planned", "InProgress", "Completed", "Delayed"];

export default function ProjectPlanning() {
  const { can } = useAuth();
  const canManage = can("project.manage_budget");
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("Active");
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");

  const { data } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  const milestones = useQuery({
    queryKey: ["projects", projectId, "milestones"],
    queryFn: async () => (await api.get<Milestone[]>(`/projects/${projectId}/milestones`)).data,
    enabled: !!projectId,
  });

  const addMilestone = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/milestones`, { name: milestoneName, dueDate: milestoneDue || null }),
    onSuccess: () => {
      setMilestoneName(""); setMilestoneDue("");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] });
    },
  });

  const updateMilestone = useMutation({
    mutationFn: (m: Milestone) => api.patch(`/projects/${projectId}/milestones/${m.id}`, { name: m.name, dueDate: m.dueDate, status: m.status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] }),
  });

  const deleteMilestone = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/milestones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "milestones"] }),
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

      {data && (
        <section style={{ ...s.section, marginTop: 24 }}>
          <h2 style={s.sectionTitle}>Milestones</h2>

          {canManage && (
            <div style={{ ...s.card, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input style={s.input} placeholder="Milestone name" value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} />
              <input type="date" style={s.input} value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} />
              <button
                style={s.addButton}
                disabled={!milestoneName.trim() || addMilestone.isPending}
                onClick={() => addMilestone.mutate()}
              >
                Add milestone
              </button>
            </div>
          )}

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Due date</th>
                  <th style={s.th}>Status</th>
                  {canManage && <th style={s.th}></th>}
                </tr>
              </thead>
              <tbody>
                {(!milestones.data || milestones.data.length === 0) && (
                  <tr><td style={s.td} colSpan={canManage ? 4 : 3}>No milestones yet.</td></tr>
                )}
                {milestones.data?.map((m) => (
                  <tr key={m.id}>
                    <td style={s.td}>{m.name}</td>
                    <td style={s.td}>{m.dueDate ?? "—"}</td>
                    <td style={s.td}>
                      {canManage ? (
                        <select
                          style={s.select}
                          value={m.status}
                          onChange={(e) => updateMilestone.mutate({ ...m, status: e.target.value })}
                        >
                          {MILESTONE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      ) : (
                        m.status
                      )}
                    </td>
                    {canManage && (
                      <td style={s.td}>
                        <button style={s.secondary} onClick={() => deleteMilestone.mutate(m.id)}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

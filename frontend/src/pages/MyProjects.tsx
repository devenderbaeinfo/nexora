import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface MyProjectRow {
  projectId: string;
  name: string;
  customerName: string;
  status: string;
  roleOnProject: string;
}

interface TimesheetRow {
  id: string;
  projectName: string;
  workDate: string;
  hours: number;
  isBillable: boolean;
  status: string;
}

interface MyTaskRow {
  id: string;
  projectId: string;
  projectName: string | null;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
}

const TASK_STATUSES = ["ToDo", "InProgress", "Done"];

export default function MyProjects() {
  const queryClient = useQueryClient();
  const [logProjectId, setLogProjectId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [isBillable, setIsBillable] = useState(true);

  const projects = useQuery({
    queryKey: ["projects", "mine"],
    queryFn: async () => (await api.get<MyProjectRow[]>("/projects/mine")).data,
  });

  const timesheets = useQuery({
    queryKey: ["timesheets", "mine"],
    queryFn: async () => (await api.get<TimesheetRow[]>("/timesheets/mine")).data,
  });

  const tasks = useQuery({
    queryKey: ["projects", "my-tasks"],
    queryFn: async () => (await api.get<MyTaskRow[]>("/projects/my-tasks")).data,
  });

  const updateTaskStatus = useMutation({
    mutationFn: ({ task, status }: { task: MyTaskRow; status: string }) =>
      api.patch(`/projects/${task.projectId}/tasks/${task.id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", "my-tasks"] }),
  });

  const logHours = useMutation({
    mutationFn: () => api.post("/timesheets", {
      projectId: logProjectId, workDate, hours: Number(hours), isBillable,
    }),
    onSuccess: () => {
      setHours("");
      queryClient.invalidateQueries({ queryKey: ["timesheets", "mine"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Projects</h1>
          <p style={s.subtitle}>Projects you're staffed on — log hours here for your manager to approve.</p>
        </div>
      </header>

      {projects.isLoading && <Spinner />}
      {!projects.isLoading && (!projects.data || projects.data.length === 0) && (
        <p style={s.muted}>You're not staffed on any projects yet.</p>
      )}

      {projects.data && projects.data.length > 0 && (
        <>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Project</th>
                  <th style={s.th}>Customer</th>
                  <th style={s.th}>Your role</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.map((p) => (
                  <tr key={p.projectId}>
                    <td style={s.td}>{p.name}</td>
                    <td style={s.td}>{p.customerName}</td>
                    <td style={s.td}>{p.roleOnProject}</td>
                    <td style={s.td}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section style={{ ...s.section, marginTop: 28 }}>
            <h2 style={s.sectionTitle}>My tasks</h2>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Task</th>
                    <th style={s.th}>Project</th>
                    <th style={s.th}>Due</th>
                    <th style={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(!tasks.data || tasks.data.length === 0) && (
                    <tr><td style={s.td} colSpan={4}>Nothing assigned to you right now.</td></tr>
                  )}
                  {tasks.data?.map((t) => (
                    <tr key={t.id}>
                      <td style={s.td}>
                        {t.title}
                        {t.description && <div style={{ color: "var(--faint)", fontSize: 12 }}>{t.description}</div>}
                      </td>
                      <td style={s.td}>{t.projectName ?? "—"}</td>
                      <td style={s.td}>{t.dueDate ?? "—"}</td>
                      <td style={s.td}>
                        <select
                          style={s.select}
                          value={t.status}
                          onChange={(e) => updateTaskStatus.mutate({ task: t, status: e.target.value })}
                        >
                          {TASK_STATUSES.map((st) => <option key={st} value={st}>{st === "ToDo" ? "To do" : st === "InProgress" ? "In progress" : st}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ ...s.section, marginTop: 28 }}>
            <h2 style={s.sectionTitle}>Log hours</h2>
            <div style={{ ...s.card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select style={s.select} value={logProjectId} onChange={(e) => setLogProjectId(e.target.value)}>
                <option value="">Select project…</option>
                {projects.data.map((p) => <option key={p.projectId} value={p.projectId}>{p.name}</option>)}
              </select>
              <input type="date" style={s.input} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              <input
                type="number" min="0.5" max="24" step="0.5" style={{ ...s.input, width: 90 }}
                placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
                <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} />
                Billable
              </label>
              <button
                style={s.addButton}
                disabled={!logProjectId || !hours || logHours.isPending}
                onClick={() => logHours.mutate()}
              >
                Submit
              </button>
            </div>
            {logHours.isError && (
              <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
                {(logHours.error as any)?.response?.data ?? "Couldn't log these hours."}
              </p>
            )}
          </section>

          <section style={s.section}>
            <h2 style={s.sectionTitle}>Recent entries</h2>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Project</th>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>Hours</th>
                    <th style={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(!timesheets.data || timesheets.data.length === 0) && (
                    <tr><td style={s.td} colSpan={4}>No hours logged yet.</td></tr>
                  )}
                  {timesheets.data?.map((t) => (
                    <tr key={t.id}>
                      <td style={s.td}>{t.projectName}</td>
                      <td style={s.td}>{t.workDate}</td>
                      <td style={s.td}>{t.hours}</td>
                      <td style={s.td}><StatusTag status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Approved: ["var(--good-soft)", "var(--good)"],
    Submitted: ["var(--warn-soft)", "var(--warn)"],
    Rejected: ["var(--danger-soft)", "var(--danger)"],
    Draft: ["var(--surface-sunken)", "var(--faint)"],
  };
  const [bg, fg] = palette[status] ?? palette.Draft;
  return <span style={tag(bg, fg)}>{status}</span>;
}

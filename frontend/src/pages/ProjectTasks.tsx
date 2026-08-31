import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ProjectPicker from "../components/ProjectPicker";
import { pageStyles as s, tag } from "../styles/pageKit";

interface ProjectTaskRow {
  id: string;
  title: string;
  description: string | null;
  assignedToEmployeeId: string | null;
  assignedToName: string | null;
  status: string;
  dueDate: string | null;
}

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
}

const STATUSES = ["ToDo", "InProgress", "Done"];

export default function ProjectTasks() {
  const { can } = useAuth();
  const canManage = can("project.manage_budget");
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const tasks = useQuery({
    queryKey: ["projects", projectId, "tasks"],
    queryFn: async () => (await api.get<ProjectTaskRow[]>(`/projects/${projectId}/tasks`)).data,
    enabled: !!projectId,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: canManage,
  });

  const addTask = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/tasks`, {
      title, assignedToEmployeeId: assignedToEmployeeId || null, dueDate: dueDate || null,
    }),
    onSuccess: () => {
      setTitle(""); setAssignedToEmployeeId(""); setDueDate("");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status, assignedToEmployeeId: assignee, dueDate: due }: { id: string; status: string; assignedToEmployeeId: string | null; dueDate: string | null }) =>
      api.patch(`/projects/${projectId}/tasks/${id}`, { status, assignedToEmployeeId: assignee, dueDate: due }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] }),
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Project Tasks</h1>
          <p style={s.subtitle}>Who's doing what on a project.</p>
        </div>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </header>

      {!projectId && <p style={s.muted}>Select a project to see its tasks.</p>}

      {projectId && canManage && (
        <section style={{ ...s.card, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...s.input, minWidth: 200 }} placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select style={s.select} value={assignedToEmployeeId} onChange={(e) => setAssignedToEmployeeId(e.target.value)}>
            <option value="">Unassigned</option>
            {employees.data?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
          <input type="date" style={s.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button style={s.addButton} disabled={!title.trim() || addTask.isPending} onClick={() => addTask.mutate()}>
            Add task
          </button>
        </section>
      )}

      {projectId && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Task</th>
                <th style={s.th}>Assigned to</th>
                <th style={s.th}>Due</th>
                <th style={s.th}>Status</th>
                {canManage && <th style={s.th}></th>}
              </tr>
            </thead>
            <tbody>
              {(!tasks.data || tasks.data.length === 0) && (
                <tr><td style={s.td} colSpan={canManage ? 5 : 4}>No tasks yet.</td></tr>
              )}
              {tasks.data?.map((t) => (
                <tr key={t.id}>
                  <td style={s.td}>{t.title}</td>
                  <td style={s.td}>{t.assignedToName ?? "—"}</td>
                  <td style={s.td}>{t.dueDate ?? "—"}</td>
                  <td style={s.td}><StatusTag status={t.status} /></td>
                  {canManage && (
                    <td style={s.td}>
                      <select
                        style={s.select}
                        value={t.status}
                        onChange={(e) => updateTask.mutate({
                          id: t.id, status: e.target.value,
                          assignedToEmployeeId: t.assignedToEmployeeId, dueDate: t.dueDate,
                        })}
                      >
                        {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Done: ["var(--good-soft)", "var(--good)"],
    InProgress: ["var(--warn-soft)", "var(--warn)"],
    ToDo: ["var(--surface-sunken)", "var(--faint)"],
  };
  const [bg, fg] = palette[status] ?? palette.ToDo;
  return <span style={tag(bg, fg)}>{status === "ToDo" ? "To do" : status === "InProgress" ? "In progress" : status}</span>;
}

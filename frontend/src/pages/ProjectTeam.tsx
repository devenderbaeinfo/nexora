import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import Spinner from "../components/Spinner";
import { pageStyles as s, tag, progressFill } from "../styles/pageKit";

interface ProjectRow {
  id: string;
  name: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  budgetAmount: number | null;
}

interface ProjectMemberRow {
  id: string;
  employeeId: string;
  employeeName: string;
  roleOnProject: string;
  costRate: number;
  billingRate: number;
}

interface ProjectTaskRow {
  id: string;
  title: string;
  description: string | null;
  assignedToEmployeeId: string | null;
  assignedToName: string | null;
  status: string;
  dueDate: string | null;
}

interface ProjectBudgetData {
  budgetAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  remaining: number;
  percentSpent: number;
}

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
}

const TASK_STATUSES = ["ToDo", "InProgress", "Done"];

export default function ProjectTeam() {
  const { can } = useAuth();
  const canManage = can("project.manage_budget");
  const [projectId, setProjectId] = useState<string | null>(null);

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectRow[]>("/projects")).data,
  });

  const liveProjects = (projects.data ?? []).filter((p) => p.status === "Active" || p.status === "OnHold");
  const selected = liveProjects.find((p) => p.id === projectId) ?? null;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Projects</h1>
          <p style={s.subtitle}>Every running project. Pick one to staff it, assign tasks, or check budget.</p>
        </div>
        {canManage && (
          <Link to="/projects/create" style={{ textDecoration: "none" }}>
            <button style={s.addButton}>Create project</button>
          </Link>
        )}
      </header>

      {projects.isLoading && <Spinner />}
      {!projects.isLoading && liveProjects.length === 0 && <p style={s.muted}>No live projects right now.</p>}

      {liveProjects.length > 0 && (
        <div style={cardGrid}>
          {liveProjects.map((p) => (
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
              {p.budgetAmount !== null && (
                <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 10, fontWeight: 600 }}>
                  {p.budgetAmount.toLocaleString(undefined, { style: "currency", currency: "USD" })} budget
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ProjectDetail key={selected.id} project={selected} canManage={canManage} onClose={() => setProjectId(null)} />
      )}
    </div>
  );
}

function ProjectDetail({ project, canManage, onClose }: { project: ProjectRow; canManage: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [roleOnProject, setRoleOnProject] = useState("");
  const [costRate, setCostRate] = useState("");
  const [billingRate, setBillingRate] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const team = useQuery({
    queryKey: ["projects", project.id, "team"],
    queryFn: async () => (await api.get<ProjectMemberRow[]>(`/projects/${project.id}/team`)).data,
  });

  const tasks = useQuery({
    queryKey: ["projects", project.id, "tasks"],
    queryFn: async () => (await api.get<ProjectTaskRow[]>(`/projects/${project.id}/tasks`)).data,
  });

  const budget = useQuery({
    queryKey: ["projects", project.id, "budget"],
    queryFn: async () => (await api.get<ProjectBudgetData>(`/projects/${project.id}/budget`)).data,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: canManage,
  });

  const addMember = useMutation({
    mutationFn: () => api.post(`/projects/${project.id}/team`, {
      employeeId, roleOnProject,
      costRate: Number(costRate) || 0, billingRate: Number(billingRate) || 0,
    }),
    onSuccess: () => {
      setEmployeeId(""); setRoleOnProject(""); setCostRate(""); setBillingRate("");
      queryClient.invalidateQueries({ queryKey: ["projects", project.id, "team"] });
    },
  });

  const updateRates = useMutation({
    mutationFn: ({ memberId, costRate, billingRate }: { memberId: string; costRate: number; billingRate: number }) =>
      api.patch(`/projects/${project.id}/team/${memberId}/rates`, { costRate, billingRate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "team"] }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/projects/${project.id}/team/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "team"] }),
  });

  const addTask = useMutation({
    mutationFn: () => api.post(`/projects/${project.id}/tasks`, {
      title: taskTitle, assignedToEmployeeId: taskAssignee || null, dueDate: taskDue || null,
    }),
    onSuccess: () => {
      setTaskTitle(""); setTaskAssignee(""); setTaskDue(""); setAssignOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects", project.id, "tasks"] });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status, assignedToEmployeeId, dueDate }: { id: string; status: string; assignedToEmployeeId: string | null; dueDate: string | null }) =>
      api.patch(`/projects/${project.id}/tasks/${id}`, { status, assignedToEmployeeId, dueDate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "tasks"] }),
  });

  const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-display)" }}>{project.name}</h2>
        <button style={s.secondary} onClick={onClose}>Close</button>
      </div>

      {budget.data && (
        <div style={{ ...s.statGrid, marginBottom: 24 }}>
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
      )}

      {budget.data && (
        <div style={{ ...s.card, marginBottom: 28 }}>
          <div style={{ fontSize: 13, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span>Committed (approved + pending)</span>
            <span style={s.muted}>{budget.data.percentSpent}% of budget</span>
          </div>
          <div style={s.progressTrack}>
            <div style={progressFill(budget.data.percentSpent, budget.data.percentSpent > 90)} />
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Team</h3>
          </div>

          {canManage && (
            <div style={{ ...s.card, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select style={s.select} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Select employee…</option>
                {employees.data?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
              <input style={s.input} placeholder="Role on project" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)} />
              <input style={{ ...s.input, width: 100 }} type="number" min={0} placeholder="Cost rate/hr" value={costRate} onChange={(e) => setCostRate(e.target.value)} />
              <input style={{ ...s.input, width: 100 }} type="number" min={0} placeholder="Bill rate/hr" value={billingRate} onChange={(e) => setBillingRate(e.target.value)} />
              <button
                style={s.addButton}
                disabled={!employeeId || !roleOnProject.trim() || addMember.isPending}
                onClick={() => addMember.mutate()}
              >
                Add
              </button>
            </div>
          )}

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Role</th>
                  {canManage && <th style={s.th}>Cost/hr</th>}
                  {canManage && <th style={s.th}>Bill/hr</th>}
                  {canManage && <th style={s.th}></th>}
                </tr>
              </thead>
              <tbody>
                {(!team.data || team.data.length === 0) && (
                  <tr><td style={s.td} colSpan={canManage ? 5 : 2}>No one staffed yet.</td></tr>
                )}
                {team.data?.map((m) => (
                  <tr key={m.id}>
                    <td style={s.td}>{m.employeeName}</td>
                    <td style={s.td}>{m.roleOnProject}</td>
                    {canManage && (
                      <td style={s.td}>
                        <input
                          style={{ ...s.input, width: 80 }} type="number" min={0}
                          defaultValue={m.costRate}
                          onBlur={(e) => {
                            const v = Number(e.target.value) || 0;
                            if (v !== m.costRate) updateRates.mutate({ memberId: m.id, costRate: v, billingRate: m.billingRate });
                          }}
                        />
                      </td>
                    )}
                    {canManage && (
                      <td style={s.td}>
                        <input
                          style={{ ...s.input, width: 80 }} type="number" min={0}
                          defaultValue={m.billingRate}
                          onBlur={(e) => {
                            const v = Number(e.target.value) || 0;
                            if (v !== m.billingRate) updateRates.mutate({ memberId: m.id, costRate: m.costRate, billingRate: v });
                          }}
                        />
                      </td>
                    )}
                    {canManage && (
                      <td style={s.td}>
                        <button style={s.secondary} onClick={() => removeMember.mutate(m.id)}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Tasks</h3>
            {canManage && <button style={s.addButton} onClick={() => setAssignOpen(true)}>Assign task</button>}
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Task</th>
                  <th style={s.th}>Assigned to</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(!tasks.data || tasks.data.length === 0) && (
                  <tr><td style={s.td} colSpan={3}>No tasks yet.</td></tr>
                )}
                {tasks.data?.map((t) => (
                  <tr key={t.id}>
                    <td style={s.td}>{t.title}</td>
                    <td style={s.td}>{t.assignedToName ?? "—"}</td>
                    <td style={s.td}>
                      {canManage ? (
                        <select
                          style={s.select}
                          value={t.status}
                          onChange={(e) => updateTask.mutate({
                            id: t.id, status: e.target.value,
                            assignedToEmployeeId: t.assignedToEmployeeId, dueDate: t.dueDate,
                          })}
                        >
                          {TASK_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      ) : (
                        <TaskStatusTag status={t.status} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Drawer open={assignOpen} title="Assign task" onClose={() => setAssignOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={s.input} placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <select style={s.select} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {employees.data?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
          <input type="date" style={s.input} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
          <button style={s.addButton} disabled={!taskTitle.trim() || addTask.isPending} onClick={() => addTask.mutate()}>
            Assign
          </button>
        </div>
      </Drawer>
    </div>
  );
}

function TaskStatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Done: ["var(--good-soft)", "var(--good)"],
    InProgress: ["var(--warn-soft)", "var(--warn)"],
    ToDo: ["var(--surface-sunken)", "var(--faint)"],
  };
  const [bg, fg] = palette[status] ?? palette.ToDo;
  return <span style={tag(bg, fg)}>{status === "ToDo" ? "To do" : status === "InProgress" ? "In progress" : status}</span>;
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

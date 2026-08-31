import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";
import Drawer from "../components/Drawer";

interface OnboardingTaskRow {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  dueDate: string | null;
  completedAtUtc: string | null;
  notes: string | null;
}

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function Onboarding() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [startingFor, setStartingFor] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canManage = can("onboarding.manage");

  const all = useQuery({
    queryKey: ["onboarding", "all"],
    queryFn: async () => (await api.get<OnboardingTaskRow[]>("/onboarding")).data,
    enabled: canManage,
  });

  const mine = useQuery({
    queryKey: ["onboarding", "mine"],
    queryFn: async () => (await api.get<OnboardingTaskRow[]>("/onboarding/mine")).data,
    enabled: !canManage,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: canManage,
  });

  // Only employees with no onboarding plan yet — once someone's plan is started (in
  // progress or completed) they drop off this list, so they can never be re-onboarded.
  const notStarted = useQuery({
    queryKey: ["onboarding", "not-started"],
    queryFn: async () => (await api.get<string[]>("/onboarding/not-started")).data,
    enabled: canManage && drawerOpen,
  });

  const eligibleEmployees = (employees.data ?? []).filter((e) => notStarted.data?.includes(e.id));

  const start = useMutation({
    mutationFn: (employeeId: string) => api.post("/onboarding/start", { employeeId }),
    onSuccess: () => {
      setStartingFor("");
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/onboarding/tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const rows = canManage ? all.data : mine.data;
  const isLoading = canManage ? all.isLoading : mine.isLoading;

  const grouped = groupByEmployee(rows ?? []);

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Onboarding</h1>
          <p style={styles.subtitle}>
            {canManage
              ? "Track every new hire's checklist from paperwork to POSH training."
              : "Your onboarding checklist."}
          </p>
        </div>
        {canManage && (
          <button style={styles.addButton} onClick={() => setDrawerOpen(true)}>
            Start onboarding
          </button>
        )}
      </header>

      {canManage && (
        <Drawer open={drawerOpen} title="Start onboarding" onClose={() => setDrawerOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <select
              style={{ ...styles.select, width: "100%" }}
              value={startingFor}
              onChange={(e) => setStartingFor(e.target.value)}
            >
              <option value="">Select employee…</option>
              {eligibleEmployees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
            {notStarted.isSuccess && eligibleEmployees.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                Every employee already has an onboarding plan.
              </p>
            )}
            {start.isError && (
              <p style={{ color: "var(--danger)", fontSize: 13 }}>
                {(start.error as any)?.response?.data ?? "Couldn't start onboarding for this employee."}
              </p>
            )}
            <button
              style={styles.addButton}
              disabled={!startingFor || start.isPending}
              onClick={() => start.mutate(startingFor)}
            >
              Start onboarding
            </button>
          </div>
        </Drawer>
      )}

      {isLoading && <Spinner />}

      {!isLoading && grouped.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          {canManage ? "No onboarding plans in progress." : "No onboarding tasks assigned to you yet."}
        </p>
      )}

      {grouped.map(([employeeName, tasks]) => (
        <section key={employeeName} style={styles.section}>
          {canManage && <h2 style={styles.sectionTitle}>{employeeName}</h2>}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Task</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Due</th>
                  <th style={styles.th}>Status</th>
                  {canManage && <th style={styles.th}></th>}
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={styles.td}>{t.title}</td>
                    <td style={styles.td}>{formatCategory(t.category)}</td>
                    <td style={styles.td}>{t.dueDate ?? "—"}</td>
                    <td style={styles.td}><StatusTag status={t.status} /></td>
                    {canManage && (
                      <td style={styles.td}>
                        {t.status !== "Completed" && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              style={styles.approve}
                              onClick={() => updateTask.mutate({ id: t.id, status: "Completed" })}
                            >
                              Mark done
                            </button>
                            {t.status === "Pending" && (
                              <button
                                style={styles.secondary}
                                onClick={() => updateTask.mutate({ id: t.id, status: "InProgress" })}
                              >
                                In progress
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function groupByEmployee(rows: OnboardingTaskRow[]): [string, OnboardingTaskRow[]][] {
  const map = new Map<string, OnboardingTaskRow[]>();
  for (const row of rows) {
    const list = map.get(row.employeeName) ?? [];
    list.push(row);
    map.set(row.employeeName, list);
  }
  return Array.from(map.entries());
}

function formatCategory(category: string) {
  return category.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Completed: ["var(--good-soft)", "var(--good)"],
    InProgress: ["var(--warn-soft)", "var(--warn)"],
    Pending: ["var(--surface-sunken)", "var(--faint)"],
    Skipped: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: bg, color: fg, padding: "3px 9px", borderRadius: 20 }}>{status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 460 },
  select: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
  },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  secondary: {
    background: "var(--surface-sunken)", color: "var(--muted)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

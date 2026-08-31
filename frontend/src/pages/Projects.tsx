import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import NewProjectForm from "./NewProjectForm";
import SubmitProjectExpenseForm from "./SubmitProjectExpenseForm";
import Spinner from "../components/Spinner";

interface ProjectRow {
  id: string;
  name: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  budgetAmount: number;
}

interface ProjectExpenseRow {
  id: string;
  projectName: string;
  employeeName: string;
  amount: number;
  category: string;
  description: string | null;
  incurredOn: string;
  isBillable: boolean;
  status: string;
}

export default function Projects() {
  const { can } = useAuth();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [submitExpenseOpen, setSubmitExpenseOpen] = useState(false);
  const queryClient = useQueryClient();

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectRow[]>("/projects")).data,
  });

  const mine = useQuery({
    queryKey: ["projectExpenses", "mine"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>("/project-expenses/mine")).data,
  });

  const pendingPm = useQuery({
    queryKey: ["projectExpenses", "pendingPm"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>("/project-expenses/pending-pm-approval")).data,
    enabled: can("project.approve_expense_as_pm"),
  });

  const pendingFinance = useQuery({
    queryKey: ["projectExpenses", "pendingFinance"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>("/project-expenses/pending-finance-approval")).data,
    enabled: can("project.approve_expense_as_finance"),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/project-expenses/${id}/decision`, { approve }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projectExpenses"] }),
  });

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Project Expenses</h1>
          <p style={styles.subtitle}>An expense clears its own project's manager first, then Finance.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {can("project.submit_expense") && (
            <button style={styles.addButton} onClick={() => setSubmitExpenseOpen(true)}>Submit expense</button>
          )}
          {can("project.manage_budget") && (
            <button style={styles.addButtonSecondary} onClick={() => setNewProjectOpen(true)}>New project</button>
          )}
        </div>
      </header>

      <Drawer open={submitExpenseOpen} title="Submit project expense" onClose={() => setSubmitExpenseOpen(false)}>
        <SubmitProjectExpenseForm onDone={() => setSubmitExpenseOpen(false)} />
      </Drawer>
      <Drawer open={newProjectOpen} title="New project" onClose={() => setNewProjectOpen(false)}>
        <NewProjectForm onDone={() => setNewProjectOpen(false)} />
      </Drawer>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Projects</h2>
        {projects.isLoading && <Spinner />}
        {projects.data && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Project</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Project Manager</th>
                  <th style={styles.th}>Budget</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.length === 0 && (
                  <tr><td style={styles.td} colSpan={5}>No projects yet.</td></tr>
                )}
                {projects.data.map((p) => (
                  <tr key={p.id}>
                    <td style={styles.td}><div style={{ fontWeight: 600 }}>{p.name}</div></td>
                    <td style={styles.td}>{p.customerName}</td>
                    <td style={styles.td}>{p.projectManagerName}</td>
                    <td style={styles.td}>₹{p.budgetAmount.toLocaleString()}</td>
                    <td style={styles.td}>
                      <span style={styles.tag}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {can("project.approve_expense_as_pm") && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending your approval (as project manager)</h2>
          <ExpenseTable
            rows={pendingPm.data}
            isLoading={pendingPm.isLoading}
            emptyText="Nothing waiting on you."
            renderActions={(row) => (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.approve} onClick={() => decide.mutate({ id: row.id, approve: true })}>Approve</button>
                <button style={styles.reject} onClick={() => decide.mutate({ id: row.id, approve: false })}>Reject</button>
              </div>
            )}
          />
        </section>
      )}

      {can("project.approve_expense_as_finance") && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending Finance approval</h2>
          <ExpenseTable
            rows={pendingFinance.data}
            isLoading={pendingFinance.isLoading}
            emptyText="Nothing waiting on Finance right now."
            renderActions={(row) => (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.approve} onClick={() => decide.mutate({ id: row.id, approve: true })}>Approve</button>
                <button style={styles.reject} onClick={() => decide.mutate({ id: row.id, approve: false })}>Reject</button>
              </div>
            )}
          />
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>My project expenses</h2>
        <ExpenseTable rows={mine.data} isLoading={mine.isLoading} emptyText="You haven't submitted any project expenses yet." />
      </section>
    </div>
  );
}

function ExpenseTable({
  rows, isLoading, emptyText, renderActions,
}: {
  rows?: ProjectExpenseRow[]; isLoading: boolean; emptyText: string;
  renderActions?: (row: ProjectExpenseRow) => React.ReactNode;
}) {
  if (isLoading) return <Spinner />;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Project</th>
            {renderActions && <th style={styles.th}>Employee</th>}
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Amount</th>
            <th style={styles.th}>Billable</th>
            <th style={styles.th}>Status</th>
            {renderActions && <th style={styles.th}></th>}
          </tr>
        </thead>
        <tbody>
          {(!rows || rows.length === 0) && (
            <tr><td style={styles.td} colSpan={renderActions ? 7 : 5}>{emptyText}</td></tr>
          )}
          {rows?.map((r) => (
            <tr key={r.id}>
              <td style={styles.td}>{r.projectName}</td>
              {renderActions && <td style={styles.td}>{r.employeeName}</td>}
              <td style={styles.td}>{r.category}</td>
              <td style={styles.td}>₹{r.amount.toLocaleString()}</td>
              <td style={styles.td}>{r.isBillable ? "Yes" : "No"}</td>
              <td style={styles.td}><StatusTag status={r.status} /></td>
              {renderActions && <td style={styles.td}>{renderActions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Approved: ["var(--good-soft)", "var(--good)"],
    ManagerApproved: ["var(--warn-soft)", "var(--warn)"],
    Pending: ["var(--warn-soft)", "var(--warn)"],
    Rejected: ["var(--danger-soft)", "var(--danger)"],
  };
  const labels: Record<string, string> = { ManagerApproved: "Awaiting Finance" };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: bg, color: fg, padding: "3px 9px", borderRadius: 20 }}>{labels[status] ?? status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 460 },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  addButtonSecondary: {
    background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--accent)",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 36 },
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
  tag: {
    fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--good-soft)",
    color: "var(--good)", padding: "3px 9px", borderRadius: 20,
  },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  reject: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

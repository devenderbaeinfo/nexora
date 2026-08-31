import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import SubmitReimbursementForm from "./SubmitReimbursementForm";
import Spinner from "../components/Spinner";

interface ReimbursementRow {
  id: string;
  employeeName: string;
  amount: number;
  category: string;
  description: string | null;
  incurredOn: string;
  status: string;
}

export default function Reimbursement() {
  const { can } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);
  const queryClient = useQueryClient();

  const mine = useQuery({
    queryKey: ["reimbursements", "mine"],
    queryFn: async () => (await api.get<ReimbursementRow[]>("/reimbursements/mine")).data,
  });

  const pendingManager = useQuery({
    queryKey: ["reimbursements", "pendingManager"],
    queryFn: async () => (await api.get<ReimbursementRow[]>("/reimbursements/pending-manager-approval")).data,
    enabled: can("expense.approve_as_manager"),
  });

  const pendingFinance = useQuery({
    queryKey: ["reimbursements", "pendingFinance"],
    queryFn: async () => (await api.get<ReimbursementRow[]>("/reimbursements/pending-finance-approval")).data,
    enabled: can("expense.approve_as_finance"),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/reimbursements/${id}/decision`, { approve }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    },
  });

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Reimbursement</h1>
          <p style={styles.subtitle}>A request clears its manager first, then Finance — payment is cleared only once both sign off.</p>
        </div>
        {can("expense.submit") && (
          <button style={styles.addButton} onClick={() => setSubmitOpen(true)}>Submit expense</button>
        )}
      </header>

      <Drawer open={submitOpen} title="Submit expense" onClose={() => setSubmitOpen(false)}>
        <SubmitReimbursementForm onDone={() => setSubmitOpen(false)} />
      </Drawer>

      {can("expense.approve_as_manager") && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending your approval (as manager)</h2>
          <RequestTable
            rows={pendingManager.data}
            isLoading={pendingManager.isLoading}
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

      {can("expense.approve_as_finance") && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending Finance approval</h2>
          <RequestTable
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
        <h2 style={styles.sectionTitle}>My expenses</h2>
        <RequestTable rows={mine.data} isLoading={mine.isLoading} emptyText="You haven't submitted any expenses yet." />
      </section>
    </div>
  );
}

function RequestTable({
  rows, isLoading, emptyText, renderActions,
}: {
  rows?: ReimbursementRow[]; isLoading: boolean; emptyText: string;
  renderActions?: (row: ReimbursementRow) => React.ReactNode;
}) {
  if (isLoading) return <Spinner />;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {renderActions && <th style={styles.th}>Employee</th>}
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Amount</th>
            <th style={styles.th}>Status</th>
            {renderActions && <th style={styles.th}></th>}
          </tr>
        </thead>
        <tbody>
          {(!rows || rows.length === 0) && (
            <tr><td style={styles.td} colSpan={renderActions ? 6 : 4}>{emptyText}</td></tr>
          )}
          {rows?.map((r) => (
            <tr key={r.id}>
              {renderActions && <td style={styles.td}>{r.employeeName}</td>}
              <td style={styles.td}>{r.category}</td>
              <td style={styles.td}>{r.incurredOn}</td>
              <td style={styles.td}>₹{r.amount.toLocaleString()}</td>
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
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  reject: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

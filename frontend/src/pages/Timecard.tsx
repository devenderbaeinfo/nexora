import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import SubmitLeaveForm from "./SubmitLeaveForm";
import LeaveReviewDrawer from "./LeaveReviewDrawer";
import Spinner from "../components/Spinner";

interface LeaveRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: string;
  reason: string | null;
  managerApprovalStatus: string;
  managerActedByName: string | null;
  managerActedAtUtc: string | null;
  managerComment: string | null;
  hrApprovalStatus: string;
  hrActedByName: string | null;
  hrActedAtUtc: string | null;
  hrComment: string | null;
  canCancel: boolean;
}

interface LeaveBalanceRow {
  leaveTypeName: string;
  allotted: number;
  used: number;
  remaining: number;
}

export default function Timecard() {
  const { can } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewing, setReviewing] = useState<{ row: LeaveRequestRow; stage: "manager" | "hr" } | null>(null);
  const queryClient = useQueryClient();

  const mine = useQuery({
    queryKey: ["leaveRequests", "mine"],
    queryFn: async () => (await api.get<LeaveRequestRow[]>("/leave-requests/mine")).data,
  });

  const balances = useQuery({
    queryKey: ["leaveRequests", "balances"],
    queryFn: async () => (await api.get<LeaveBalanceRow[]>("/leave-requests/balances/mine")).data,
  });

  const pendingManager = useQuery({
    queryKey: ["leaveRequests", "pendingManager"],
    queryFn: async () => (await api.get<LeaveRequestRow[]>("/leave-requests/pending-manager-approval")).data,
    enabled: can("leave.approve_as_manager"),
  });

  const pendingHr = useQuery({
    queryKey: ["leaveRequests", "pendingHr"],
    queryFn: async () => (await api.get<LeaveRequestRow[]>("/leave-requests/pending-hr-approval")).data,
    enabled: can("leave.approve_as_hr"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/leave-requests/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leaveRequests"] }),
  });

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Timecard &amp; Leave</h1>
          <p style={styles.subtitle}>A request clears its manager first, then HR — manager approval is never final, and the balance is only debited once HR signs off.</p>
        </div>
        {can("leave.submit") && (
          <button style={styles.addButton} onClick={() => setSubmitOpen(true)}>Request leave</button>
        )}
      </header>

      <Drawer open={submitOpen} title="Request leave" onClose={() => setSubmitOpen(false)}>
        <SubmitLeaveForm onDone={() => setSubmitOpen(false)} />
      </Drawer>

      <Drawer
        open={!!reviewing}
        title={reviewing?.stage === "hr" ? "HR review" : "Manager review"}
        onClose={() => setReviewing(null)}
      >
        {reviewing && (
          <LeaveReviewDrawer request={reviewing.row} stage={reviewing.stage} onDone={() => setReviewing(null)} />
        )}
      </Drawer>

      {(mine.error || balances.error || pendingManager.error || pendingHr.error) && (
        <p style={{ color: "var(--danger)", marginBottom: 20 }}>Some of this page couldn't load. Try refreshing.</p>
      )}

      {balances.data && balances.data.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>My leave balance</h2>
          <div style={styles.balanceGrid}>
            {balances.data.map((b) => (
              <div key={b.leaveTypeName} style={styles.balanceCard} className="card-surface">
                <div style={styles.balanceType}>{b.leaveTypeName}</div>
                <div style={styles.balanceRemaining}>{b.remaining}<span style={styles.balanceUnit}> / {b.allotted} days left</span></div>
                <div style={styles.balanceUsed}>{b.used} used this year</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {can("leave.approve_as_manager") && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending your approval (as manager)</h2>
          <RequestTable
            rows={pendingManager.data}
            isLoading={pendingManager.isLoading}
            emptyText="Nothing waiting on you."
            renderActions={(row) => (
              <button style={styles.reviewButton} onClick={() => setReviewing({ row, stage: "manager" })}>Review</button>
            )}
          />
        </section>
      )}

      {can("leave.approve_as_hr") && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Pending HR approval</h2>
          <p style={{ ...styles.subtitle, marginBottom: 12 }}>Only requests already approved by a manager ever reach this queue.</p>
          <RequestTable
            rows={pendingHr.data}
            isLoading={pendingHr.isLoading}
            emptyText="Nothing waiting on HR right now."
            renderActions={(row) => (
              <button style={styles.reviewButton} onClick={() => setReviewing({ row, stage: "hr" })}>Review</button>
            )}
          />
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>My requests</h2>
        <RequestTable
          rows={mine.data}
          isLoading={mine.isLoading}
          emptyText="You haven't submitted any leave yet."
          showHistory
          renderActions={(row) => row.canCancel && (
            <button style={styles.reject} disabled={cancel.isPending} onClick={() => cancel.mutate(row.id)}>Cancel</button>
          )}
        />
      </section>
    </div>
  );
}

function RequestTable({
  rows, isLoading, emptyText, renderActions, showHistory,
}: {
  rows?: LeaveRequestRow[]; isLoading: boolean; emptyText: string;
  renderActions?: (row: LeaveRequestRow) => React.ReactNode;
  showHistory?: boolean;
}) {
  if (isLoading) return <Spinner />;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {!showHistory && <th style={styles.th}>Employee</th>}
            <th style={styles.th}>Type</th>
            <th style={styles.th}>Dates</th>
            <th style={styles.th}>Days</th>
            <th style={styles.th}>Status</th>
            {showHistory && <th style={styles.th}>Approval history</th>}
            {renderActions && <th style={styles.th}></th>}
          </tr>
        </thead>
        <tbody>
          {(!rows || rows.length === 0) && (
            <tr><td style={styles.td} colSpan={6}>{emptyText}</td></tr>
          )}
          {rows?.map((r) => (
            <tr key={r.id}>
              {!showHistory && <td style={styles.td}>{r.employeeName}</td>}
              <td style={styles.td}>{r.leaveTypeName}</td>
              <td style={styles.td}>{r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`}</td>
              <td style={styles.td}>{r.daysRequested}</td>
              <td style={styles.td}><StatusTag status={r.status} /></td>
              {showHistory && (
                <td style={{ ...styles.td, fontSize: 12 }}>
                  <ApprovalHistory row={r} />
                </td>
              )}
              {renderActions && <td style={styles.td}>{renderActions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalHistory({ row }: { row: LeaveRequestRow }) {
  const parts: string[] = [];
  if (row.managerApprovalStatus === "Approved") parts.push(`✓ Manager: ${row.managerActedByName ?? "—"}`);
  else if (row.managerApprovalStatus === "Rejected") parts.push(`✗ Manager: ${row.managerActedByName ?? "—"}${row.managerComment ? ` — "${row.managerComment}"` : ""}`);
  else parts.push("Manager: pending");

  if (row.hrApprovalStatus === "Approved") parts.push(`✓ HR: ${row.hrActedByName ?? "—"}`);
  else if (row.hrApprovalStatus === "Rejected") parts.push(`✗ HR: ${row.hrActedByName ?? "—"}${row.hrComment ? ` — "${row.hrComment}"` : ""}`);
  else if (row.hrApprovalStatus === "Pending") parts.push("HR: pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--muted)" }}>
      {parts.map((p, i) => <span key={i}>{p}</span>)}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Approved: ["var(--good-soft)", "var(--good)"],
    PendingHrApproval: ["var(--warn-soft)", "var(--warn)"],
    PendingManagerApproval: ["var(--warn-soft)", "var(--warn)"],
    RejectedByManager: ["var(--danger-soft)", "var(--danger)"],
    RejectedByHr: ["var(--danger-soft)", "var(--danger)"],
    Cancelled: ["var(--surface-sunken)", "var(--faint)"],
  };
  const labels: Record<string, string> = {
    PendingManagerApproval: "Pending manager approval",
    PendingHrApproval: "Approved by manager — pending HR",
    RejectedByManager: "Rejected by manager",
    RejectedByHr: "Manager approved, HR rejected",
  };
  const [bg, fg] = palette[status] ?? palette.PendingManagerApproval;
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
  balanceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 },
  balanceCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, boxShadow: "var(--shadow)",
  },
  balanceType: { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 },
  balanceRemaining: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--accent)" },
  balanceUnit: { fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 500, color: "var(--faint)" },
  balanceUsed: { fontSize: 12, color: "var(--teal)", marginTop: 4, fontWeight: 600 },
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
  reviewButton: {
    background: "var(--accent-soft)", color: "var(--accent)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 14px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  reject: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

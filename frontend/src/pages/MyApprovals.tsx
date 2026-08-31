import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";

interface ApprovalRow {
  id: string;
  employeeName: string;
  detail: string;
  amount: string;
}

interface Queue {
  label: string;
  endpoint: string;
  decisionPath: string;
  queryKey: string;
  mapRow: (raw: any) => ApprovalRow;
  isLeave?: boolean;
}

const mapLeave = (r: any): ApprovalRow => ({
  id: r.id, employeeName: r.employeeName,
  detail: `${r.leaveTypeName} · ${r.startDate === r.endDate ? r.startDate : `${r.startDate} → ${r.endDate}`}`,
  amount: `${r.daysRequested} day(s)`,
});

const mapExpense = (r: any): ApprovalRow => ({
  id: r.id, employeeName: r.employeeName, detail: r.category,
  amount: r.amount.toLocaleString(undefined, { style: "currency", currency: "USD" }),
});

export default function MyApprovals() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const queues: Queue[] = [
    ...(can("leave.approve_as_manager")
      ? [{ label: "Leave — pending your approval", endpoint: "/leave-requests/pending-manager-approval", decisionPath: "leave-requests", queryKey: "leave-mgr", mapRow: mapLeave, isLeave: true }]
      : []),
    ...(can("leave.approve_as_hr")
      ? [{ label: "Leave — pending HR approval", endpoint: "/leave-requests/pending-hr-approval", decisionPath: "leave-requests", queryKey: "leave-hr", mapRow: mapLeave, isLeave: true }]
      : []),
    ...(can("expense.approve_as_manager")
      ? [{ label: "Reimbursements — pending your approval", endpoint: "/reimbursements/pending-manager-approval", decisionPath: "reimbursements", queryKey: "reimb-mgr", mapRow: mapExpense }]
      : []),
    ...(can("expense.approve_as_finance")
      ? [{ label: "Reimbursements — pending finance approval", endpoint: "/reimbursements/pending-finance-approval", decisionPath: "reimbursements", queryKey: "reimb-fin", mapRow: mapExpense }]
      : []),
    ...(can("project.approve_expense_as_pm")
      ? [{ label: "Project expenses — pending your approval", endpoint: "/project-expenses/pending-pm-approval", decisionPath: "project-expenses", queryKey: "pexp-pm", mapRow: mapExpense }]
      : []),
    ...(can("project.approve_expense_as_finance")
      ? [{ label: "Project expenses — pending finance approval", endpoint: "/project-expenses/pending-finance-approval", decisionPath: "project-expenses", queryKey: "pexp-fin", mapRow: mapExpense }]
      : []),
  ];

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Approvals</h1>
          <p style={s.subtitle}>Everything across leave and expenses waiting on your decision.</p>
        </div>
      </header>

      {queues.length === 0 && <p style={s.muted}>Nothing waiting on you.</p>}

      {queues.map((queue) => (
        <QueueSection key={queue.queryKey} queue={queue} onDecided={() => queryClient.invalidateQueries()} />
      ))}
    </div>
  );
}

function QueueSection({ queue, onDecided }: { queue: Queue; onDecided: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-approvals", queue.queryKey],
    queryFn: async () => (await api.get<any[]>(queue.endpoint)).data.map(queue.mapRow),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/${queue.decisionPath}/${id}/decision`, { approve }),
    onSuccess: onDecided,
  });

  if (isLoading) return null;
  if (error) {
    return (
      <section style={s.section}>
        <h2 style={s.sectionTitle}>{queue.label}</h2>
        <p style={{ color: "var(--danger)", fontSize: 13.5 }}>Couldn't load this queue. Try refreshing.</p>
      </section>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>{queue.label}</h2>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Employee</th>
              <th style={s.th}>Detail</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td style={s.td}>{r.employeeName}</td>
                <td style={s.td}>{r.detail}</td>
                <td style={s.td}>{r.amount}</td>
                <td style={s.td}>
                  {queue.isLeave ? (
                    <Link to="/timecard" style={{ textDecoration: "none" }}>
                      <button style={s.approve}>Review in Timecard</button>
                    </Link>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={s.approve} onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</button>
                      <button style={s.reject} onClick={() => decide.mutate({ id: r.id, approve: false })}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

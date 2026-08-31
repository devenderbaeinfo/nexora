import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";
import BulkActionBar from "../components/BulkActionBar";
import { useBulkDecision } from "../hooks/useBulkDecision";

interface ExpenseRow {
  id: string;
  employeeName: string;
  amount: number;
  category: string;
  description: string | null;
  incurredOn: string;
  status: string;
}

type Kind = "reimbursements" | "project-expenses";
interface Queue { kind: Kind; label: string; endpoint: string; queryKey: string; }

export default function ExpenseApprovals() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const queues: Queue[] = [
    ...(can("expense.approve_as_manager")
      ? [{ kind: "reimbursements" as Kind, label: "Reimbursements — pending your approval", endpoint: "/reimbursements/pending-manager-approval", queryKey: "reimb-mgr" }]
      : []),
    ...(can("expense.approve_as_finance")
      ? [{ kind: "reimbursements" as Kind, label: "Reimbursements — pending finance approval", endpoint: "/reimbursements/pending-finance-approval", queryKey: "reimb-fin" }]
      : []),
    ...(can("project.approve_expense_as_pm")
      ? [{ kind: "project-expenses" as Kind, label: "Project expenses — pending your approval", endpoint: "/project-expenses/pending-pm-approval", queryKey: "pexp-pm" }]
      : []),
    ...(can("project.approve_expense_as_finance")
      ? [{ kind: "project-expenses" as Kind, label: "Project expenses — pending finance approval", endpoint: "/project-expenses/pending-finance-approval", queryKey: "pexp-fin" }]
      : []),
  ];

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Expense Approvals</h1>
          <p style={s.subtitle}>Reimbursements and project expenses waiting on you.</p>
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
  const { data, isLoading } = useQuery({
    queryKey: ["expense-approvals", queue.queryKey],
    queryFn: async () => (await api.get<ExpenseRow[]>(queue.endpoint)).data,
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/${queue.kind}/${id}/decision`, { approve }),
    onSuccess: onDecided,
  });

  const { selected, toggle, toggleAll, bulkDecide } = useBulkDecision(`/${queue.kind}`, ["expense-approvals"]);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  const ids = data.map((r) => r.id);

  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>{queue.label}</h2>
      <BulkActionBar
        count={selected.size}
        pending={bulkDecide.isPending}
        onApprove={() => bulkDecide.mutate({ approve: true })}
        onReject={() => bulkDecide.mutate({ approve: false })}
      />
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>
                <input type="checkbox" checked={ids.length > 0 && ids.every((id) => selected.has(id))} onChange={() => toggleAll(ids)} />
              </th>
              <th style={s.th}>Employee</th>
              <th style={s.th}>Category</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Incurred</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td style={s.td}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td style={s.td}>{r.employeeName}</td>
                <td style={s.td}>{r.category}</td>
                <td style={s.td}>{r.amount.toLocaleString(undefined, { style: "currency", currency: "USD" })}</td>
                <td style={s.td}>{r.incurredOn}</td>
                <td style={s.td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={s.approve} onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</button>
                    <button style={s.reject} onClick={() => decide.mutate({ id: r.id, approve: false })}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

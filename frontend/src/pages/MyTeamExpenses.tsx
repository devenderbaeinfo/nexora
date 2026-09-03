import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface ReimbursementRow {
  id: string;
  employeeName: string;
  amount: number;
  category: string;
  description: string | null;
  incurredOn: string;
  status: string;
}

export default function MyTeamExpenses() {
  const { data, isLoading } = useQuery({
    queryKey: ["reimbursements", "team"],
    queryFn: async () => (await api.get<ReimbursementRow[]>("/reimbursements/team")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Team Expenses</h1>
          <p style={s.subtitle}>Every reimbursement claim submitted by your direct reports, any status.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>No claims from your team yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Employee</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Incurred</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td style={s.td}>{r.employeeName}</td>
                  <td style={s.td}>{r.category}</td>
                  <td style={s.td}>{formatCurrency(r.amount)}</td>
                  <td style={s.td}>{r.incurredOn}</td>
                  <td style={s.td}><StatusTag status={r.status} /></td>
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
    Approved: ["var(--good-soft)", "var(--good)"],
    ManagerApproved: ["var(--warn-soft)", "var(--warn)"],
    Pending: ["var(--warn-soft)", "var(--warn)"],
    Rejected: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={tag(bg, fg)}>{status}</span>;
}

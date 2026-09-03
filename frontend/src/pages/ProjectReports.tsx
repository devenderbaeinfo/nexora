import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface ProjectReportRow {
  projectId: string;
  projectName: string;
  status: string;
  budgetAmount: number;
  approvedSpend: number;
  pendingSpend: number;
  percentSpent: number;
}

export default function ProjectReports() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "projects"],
    queryFn: async () => (await api.get<ProjectReportRow[]>("/reports/projects")).data,
  });

  const currency = formatCurrency;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Project Reports</h1>
          <p style={s.subtitle}>Budget vs. spend for projects you manage.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>You don't manage any projects.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Project</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Budget</th>
                <th style={s.th}>Approved</th>
                <th style={s.th}>Pending</th>
                <th style={s.th}>% Spent</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.projectId}>
                  <td style={s.td}>{r.projectName}</td>
                  <td style={s.td}>{r.status}</td>
                  <td style={s.td}>{currency(r.budgetAmount)}</td>
                  <td style={s.td}>{currency(r.approvedSpend)}</td>
                  <td style={s.td}>{currency(r.pendingSpend)}</td>
                  <td style={s.td}>{r.percentSpent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

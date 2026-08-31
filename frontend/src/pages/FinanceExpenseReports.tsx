import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface ExpenseReportRow {
  category: string;
  reimbursementTotal: number;
  projectExpenseTotal: number;
  count: number;
}

export default function FinanceExpenseReports() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "expenses-all"],
    queryFn: async () => (await api.get<ExpenseReportRow[]>("/reports/expenses-all")).data,
  });

  const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Expense Reports</h1>
          <p style={s.subtitle}>Reimbursements and project expenses by category, tenant-wide.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>No expenses to report on yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Category</th>
                <th style={s.th}>Reimbursements</th>
                <th style={s.th}>Project expenses</th>
                <th style={s.th}>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.category}>
                  <td style={s.td}>{r.category}</td>
                  <td style={s.td}>{currency(r.reimbursementTotal)}</td>
                  <td style={s.td}>{currency(r.projectExpenseTotal)}</td>
                  <td style={s.td}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

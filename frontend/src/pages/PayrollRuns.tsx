import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface PayrollRunDto {
  id: string; periodMonth: number; periodYear: number; status: "Draft" | "Approved" | "Disbursed";
  payslipCount: number; totalNetPay: number; createdAtUtc: string;
  approvedAtUtc: string | null; disbursedAtUtc: string | null; journalEntryId: string | null;
  skippedEmployeeNames: string[];
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const STATUS_PALETTE: Record<string, [string, string]> = {
  Draft: ["var(--surface-sunken)", "var(--muted)"],
  Approved: ["var(--warn-soft)", "var(--warn)"],
  Disbursed: ["var(--good-soft)", "var(--good)"],
};

export default function PayrollRuns() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [processError, setProcessError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payroll", "runs"],
    queryFn: async () => (await api.get<PayrollRunDto[]>("/payroll/runs")).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payroll", "runs"] });

  const process = useMutation({
    mutationFn: () => api.post("/payroll/runs", { periodMonth: month, periodYear: year }),
    onSuccess: () => { setProcessError(null); invalidate(); },
    onError: (err: any) => setProcessError(err?.response?.data ?? "Couldn't process payroll for this period."),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/approve`),
    onSuccess: invalidate,
  });

  const disburse = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/disburse`),
    onSuccess: invalidate,
    onError: (err: any) => alert(err?.response?.data ?? "Couldn't disburse this run."),
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Payroll Runs</h1>
          <p style={s.subtitle}>Process a month's payroll from each employee's salary structure and approved leave, then approve and disburse it.</p>
        </div>
      </header>

      {can("payroll.manage") && (
        <section style={{ ...s.card, marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Month</label>
            <select style={s.select} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Year</label>
            <input type="number" style={{ ...s.input, width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button style={s.addButton} disabled={process.isPending} onClick={() => process.mutate()}>
            {process.isPending ? "Processing…" : "Process payroll"}
          </button>
          {processError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{String(processError)}</p>}
        </section>
      )}

      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load payroll runs.</p>}
      {data && data.length === 0 && <p style={s.muted}>No payroll runs yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Period</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Employees paid</th>
                <th style={s.th}>Total net pay</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((run) => {
                const [bg, fg] = STATUS_PALETTE[run.status];
                return (
                  <tr key={run.id}>
                    <td style={s.td}>
                      <Link to={`/payroll/runs/${run.id}`} style={{ fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                        {MONTHS[run.periodMonth]} {run.periodYear}
                      </Link>
                      {run.skippedEmployeeNames.length > 0 && (
                        <div style={{ fontSize: 11.5, color: "var(--warn)", marginTop: 3 }}>
                          {run.skippedEmployeeNames.length} skipped (no salary structure)
                        </div>
                      )}
                    </td>
                    <td style={s.td}><span style={tag(bg, fg)}>{run.status}</span></td>
                    <td style={s.td}>{run.payslipCount}</td>
                    <td style={s.td}>{currency(run.totalNetPay)}</td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {run.status === "Draft" && can("payroll.approve") && (
                          <button style={s.approve} disabled={approve.isPending} onClick={() => approve.mutate(run.id)}>Approve</button>
                        )}
                        {run.status === "Approved" && can("payroll.approve") && (
                          <button style={s.approve} disabled={disburse.isPending} onClick={() => disburse.mutate(run.id)}>Disburse</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import Drawer from "../components/Drawer";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import PayslipDetailView from "./PayslipDetailView";

interface PayrollRunDto {
  id: string; periodMonth: number; periodYear: number; status: string;
  payslipCount: number; totalNetPay: number; journalEntryId: string | null; skippedEmployeeNames: string[];
}
interface PayslipListItemDto {
  id: string; employeeId: string; employeeName: string;
  grossEarnings: number; lopDays: number; lopDeduction: number; otherDeductions: number; netPay: number;
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function PayrollRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [openPayslipId, setOpenPayslipId] = useState<string | null>(null);

  const run = useQuery({
    queryKey: ["payroll", "run", runId],
    queryFn: async () => (await api.get<PayrollRunDto>(`/payroll/runs/${runId}`)).data,
    enabled: !!runId,
  });

  const payslips = useQuery({
    queryKey: ["payroll", "run", runId, "payslips"],
    queryFn: async () => (await api.get<PayslipListItemDto[]>(`/payroll/runs/${runId}/payslips`)).data,
    enabled: !!runId,
  });

  const columns: DataTableColumn<PayslipListItemDto>[] = [
    {
      key: "employee", header: "Employee", value: (p) => p.employeeName,
      render: (p) => <button style={linkButtonStyle} onClick={() => setOpenPayslipId(p.id)}>{p.employeeName}</button>,
    },
    { key: "gross", header: "Gross", value: (p) => p.grossEarnings, render: (p) => currency(p.grossEarnings) },
    { key: "lop", header: "LOP days", value: (p) => p.lopDays, render: (p) => p.lopDays || "—" },
    { key: "deductions", header: "Deductions", value: (p) => p.lopDeduction + p.otherDeductions, render: (p) => currency(p.lopDeduction + p.otherDeductions) },
    { key: "net", header: "Net pay", value: (p) => p.netPay, render: (p) => <strong>{currency(p.netPay)}</strong> },
  ];

  if (run.isLoading) return <Spinner />;
  if (run.error || !run.data) return <p style={{ color: "var(--danger)" }}>Couldn't load this payroll run.</p>;

  return (
    <div>
      <Link to="/payroll/runs" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>← Payroll Runs</Link>

      <header style={{ ...s.header, marginTop: 12 }}>
        <div>
          <h1 style={s.title}>{MONTHS[run.data.periodMonth]} {run.data.periodYear}</h1>
          <p style={s.subtitle}>{run.data.status} · {run.data.payslipCount} employee(s) · {currency(run.data.totalNetPay)} total net pay</p>
        </div>
      </header>

      {run.data.skippedEmployeeNames.length > 0 && (
        <div style={{ ...s.card, borderColor: "var(--warn)", marginBottom: 20 }}>
          <strong style={{ color: "var(--warn)" }}>{run.data.skippedEmployeeNames.length} employee(s) skipped</strong> — no active salary structure at processing time:
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>{run.data.skippedEmployeeNames.join(", ")}</div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={payslips.data ?? []}
        rowKey={(p) => p.id}
        isLoading={payslips.isLoading}
        error={payslips.error}
        emptyMessage="No payslips in this run."
        searchPlaceholder="Search employee…"
        exportFileName={`payroll-${run.data.periodYear}-${run.data.periodMonth}`}
      />

      <Drawer open={!!openPayslipId} title="Payslip" onClose={() => setOpenPayslipId(null)}>
        {openPayslipId && <PayslipDetailView payslipId={openPayslipId} />}
      </Drawer>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600,
  color: "var(--accent)", cursor: "pointer", textAlign: "left",
};

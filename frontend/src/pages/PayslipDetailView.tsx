import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface PayslipLineDto { componentName: string; type: "Earning" | "Deduction"; amount: number; }
interface PayslipDetailDto {
  id: string; payrollRunId: string; periodMonth: number; periodYear: number; employeeName: string;
  daysInMonth: number; lopDays: number; grossEarnings: number | null; lopDeduction: number;
  otherDeductions: number; netPay: number | null; lines: PayslipLineDto[];
}

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currency = formatCurrency;

export default function PayslipDetailView({ payslipId }: { payslipId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["payroll", "payslip", payslipId],
    queryFn: async () => (await api.get<PayslipDetailDto>(`/payroll/payslips/${payslipId}`)).data,
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <p style={{ color: "var(--danger)" }}>Couldn't load this payslip.</p>;

  const earnings = data.lines.filter((l) => l.type === "Earning");
  const deductions = data.lines.filter((l) => l.type === "Deduction");
  const totalDeductions = data.lopDeduction + data.otherDeductions;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{data.employeeName}</div>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>{MONTHS[data.periodMonth]} {data.periodYear} · {data.daysInMonth} days</div>
        {data.lopDays > 0 && (
          <div style={{ marginTop: 6 }}>
            <span style={tag("var(--warn-soft)", "var(--warn)")}>{data.lopDays} day(s) loss of pay</span>
          </div>
        )}
      </div>

      <div style={s.card}>
        <div style={sectionLabel}>Earnings</div>
        {earnings.map((l) => <LineRow key={l.componentName} label={l.componentName} amount={l.amount} />)}
        <LineRow label="Gross earnings" amount={data.grossEarnings} bold />

        <div style={{ ...sectionLabel, marginTop: 16 }}>Deductions</div>
        {deductions.map((l) => <LineRow key={l.componentName} label={l.componentName} amount={l.amount} negative />)}
        <LineRow label="Total deductions" amount={totalDeductions} bold negative />

        <div style={{ borderTop: "1px solid var(--border-strong)", marginTop: 14, paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Net pay</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>
            {data.netPay === null ? "Hidden" : currency(data.netPay)}
          </span>
        </div>
      </div>
    </div>
  );
}

// amount is null when this role's field access to it is Hidden (see FieldPermissionCatalog["Payslip"]).
function LineRow({ label, amount, bold, negative }: { label: string; amount: number | null; bold?: boolean; negative?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13.5, fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: bold ? "var(--ink)" : "var(--muted)" }}>{label}</span>
      <span style={{ color: negative ? "var(--danger)" : "var(--ink)" }}>
        {amount === null ? "Hidden" : `${negative ? "-" : ""}${currency(amount)}`}
      </span>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase",
  color: "var(--faint)", marginBottom: 4,
};

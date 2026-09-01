import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import Drawer from "../components/Drawer";
import PayslipDetailView from "./PayslipDetailView";

interface PayslipListItemDto {
  id: string; grossEarnings: number; lopDays: number; lopDeduction: number; otherDeductions: number; netPay: number;
}

const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function MyPayslips() {
  const [openPayslipId, setOpenPayslipId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["payroll", "payslips", "mine"],
    queryFn: async () => (await api.get<PayslipListItemDto[]>("/payroll/payslips/mine")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Payslips</h1>
          <p style={s.subtitle}>Every payslip generated for you, most recent first.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load your payslips.</p>}
      {data && data.length === 0 && <p style={s.muted}>No payslips yet — they'll appear here once payroll has been processed and disbursed.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Gross</th>
                <th style={s.th}>LOP days</th>
                <th style={s.th}>Deductions</th>
                <th style={s.th}>Net pay</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td style={s.td}>{currency(p.grossEarnings)}</td>
                  <td style={s.td}>{p.lopDays || "—"}</td>
                  <td style={s.td}>{currency(p.lopDeduction + p.otherDeductions)}</td>
                  <td style={s.td}><strong>{currency(p.netPay)}</strong></td>
                  <td style={s.td}>
                    <button style={s.secondary} onClick={() => setOpenPayslipId(p.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!openPayslipId} title="Payslip" onClose={() => setOpenPayslipId(null)}>
        {openPayslipId && <PayslipDetailView payslipId={openPayslipId} />}
      </Drawer>
    </div>
  );
}

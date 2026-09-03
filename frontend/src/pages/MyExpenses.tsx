import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import Drawer from "../components/Drawer";
import SubmitReimbursementForm from "./SubmitReimbursementForm";
import SubmitProjectExpenseForm from "./SubmitProjectExpenseForm";
import { pageStyles as s, tag } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface ReimbursementRow {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  incurredOn: string;
  status: string;
  journalEntryId: string | null;
}

interface ProjectExpenseRow {
  id: string;
  projectName: string;
  amount: number;
  category: string;
  incurredOn: string;
  status: string;
  journalEntryId: string | null;
}

export default function MyExpenses() {
  const [reimbursementOpen, setReimbursementOpen] = useState(false);
  const [projectExpenseOpen, setProjectExpenseOpen] = useState(false);

  const reimbursements = useQuery({
    queryKey: ["reimbursements", "mine"],
    queryFn: async () => (await api.get<ReimbursementRow[]>("/reimbursements/mine")).data,
  });

  const projectExpenses = useQuery({
    queryKey: ["project-expenses", "mine"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>("/project-expenses/mine")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Expenses</h1>
          <p style={s.subtitle}>Reimbursements and project expenses you've submitted.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.addButton} onClick={() => setReimbursementOpen(true)}>New reimbursement</button>
          <button style={s.addButton} onClick={() => setProjectExpenseOpen(true)}>New project expense</button>
        </div>
      </header>

      <Drawer open={reimbursementOpen} title="Request reimbursement" onClose={() => setReimbursementOpen(false)}>
        <SubmitReimbursementForm onDone={() => setReimbursementOpen(false)} />
      </Drawer>
      <Drawer open={projectExpenseOpen} title="Submit project expense" onClose={() => setProjectExpenseOpen(false)}>
        <SubmitProjectExpenseForm onDone={() => setProjectExpenseOpen(false)} />
      </Drawer>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Reimbursements</h2>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Category</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Incurred</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!reimbursements.data || reimbursements.data.length === 0) && (
                <tr><td style={s.td} colSpan={4}>No reimbursements yet.</td></tr>
              )}
              {reimbursements.data?.map((r) => (
                <tr key={r.id}>
                  <td style={s.td}>{r.category}</td>
                  <td style={s.td}>{formatCurrency(r.amount)}</td>
                  <td style={s.td}>{r.incurredOn}</td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <StatusTag status={r.status} />
                      {r.journalEntryId && <span style={tag("var(--teal-soft)", "var(--teal)")} title="Posted to the General Ledger">Posted</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Project expenses</h2>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Project</th>
                <th style={s.th}>Category</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Incurred</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!projectExpenses.data || projectExpenses.data.length === 0) && (
                <tr><td style={s.td} colSpan={5}>No project expenses yet.</td></tr>
              )}
              {projectExpenses.data?.map((e) => (
                <tr key={e.id}>
                  <td style={s.td}>{e.projectName}</td>
                  <td style={s.td}>{e.category}</td>
                  <td style={s.td}>{formatCurrency(e.amount)}</td>
                  <td style={s.td}>{e.incurredOn}</td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <StatusTag status={e.status} />
                      {e.journalEntryId && <span style={tag("var(--teal-soft)", "var(--teal)")} title="Posted to the General Ledger">Posted</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

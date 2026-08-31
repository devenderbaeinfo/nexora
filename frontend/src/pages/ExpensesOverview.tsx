import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import Spinner from "../components/Spinner";
import SubmitReimbursementForm from "./SubmitReimbursementForm";
import SubmitProjectExpenseForm from "./SubmitProjectExpenseForm";
import { pageStyles as s } from "../styles/pageKit";

interface ExpenseRow {
  id: string;
  amount: number;
  status: string;
}

const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

// The Expenses module's command center: what I owe/am owed, what's waiting for a decision,
// and the fastest way to submit something — instead of landing straight on a bare table.
export default function ExpensesOverview() {
  const { can } = useAuth();
  const [reimbursementOpen, setReimbursementOpen] = useState(false);
  const [projectExpenseOpen, setProjectExpenseOpen] = useState(false);

  const myReimbursements = useQuery({
    queryKey: ["reimbursements", "mine"],
    queryFn: async () => (await api.get<ExpenseRow[]>("/reimbursements/mine")).data,
    enabled: can("expense.submit"),
  });

  const myProjectExpenses = useQuery({
    queryKey: ["project-expenses", "mine"],
    queryFn: async () => (await api.get<ExpenseRow[]>("/project-expenses/mine")).data,
    enabled: can("project.submit_expense"),
  });

  const queues = [
    ...(can("expense.approve_as_manager") ? [{ key: "reimb-mgr", endpoint: "/reimbursements/pending-manager-approval" }] : []),
    ...(can("expense.approve_as_finance") ? [{ key: "reimb-fin", endpoint: "/reimbursements/pending-finance-approval" }] : []),
    ...(can("project.approve_expense_as_pm") ? [{ key: "pexp-pm", endpoint: "/project-expenses/pending-pm-approval" }] : []),
    ...(can("project.approve_expense_as_finance") ? [{ key: "pexp-fin", endpoint: "/project-expenses/pending-finance-approval" }] : []),
  ];
  const pendingReview = useQuery({
    queryKey: ["expense-approvals", "overview-count", queues.map((q) => q.key)],
    queryFn: async () => {
      const results = await Promise.all(queues.map((q) => api.get<ExpenseRow[]>(q.endpoint)));
      return results.reduce((sum, r) => sum + r.data.length, 0);
    },
    enabled: queues.length > 0,
  });

  const myPendingTotal =
    (myReimbursements.data?.filter((r) => r.status === "Pending" || r.status === "ManagerApproved").reduce((sum, r) => sum + r.amount, 0) ?? 0) +
    (myProjectExpenses.data?.filter((r) => r.status === "Pending" || r.status === "ManagerApproved").reduce((sum, r) => sum + r.amount, 0) ?? 0);

  const myApprovedTotal =
    (myReimbursements.data?.filter((r) => r.status === "Approved").reduce((sum, r) => sum + r.amount, 0) ?? 0) +
    (myProjectExpenses.data?.filter((r) => r.status === "Approved").reduce((sum, r) => sum + r.amount, 0) ?? 0);

  const isLoading = myReimbursements.isFetching || myProjectExpenses.isFetching || pendingReview.isFetching;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Expenses</h1>
          <p style={s.subtitle}>Manage employee and project expenses.</p>
        </div>
      </header>

      {isLoading && <Spinner />}

      <div style={s.statGrid}>
        {(myReimbursements.isSuccess || myProjectExpenses.isSuccess) && (
          <div style={s.statCard}>
            <div style={s.statLabel}>My pending expenses</div>
            <div style={s.statValue}>{currency(myPendingTotal)}</div>
          </div>
        )}
        {pendingReview.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending review</div>
            <div style={s.statValue}>{pendingReview.data}</div>
          </div>
        )}
        {(myReimbursements.isSuccess || myProjectExpenses.isSuccess) && (
          <div style={s.statCard}>
            <div style={s.statLabel}>My approved reimbursements</div>
            <div style={s.statValue}>{currency(myApprovedTotal)}</div>
          </div>
        )}
      </div>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Quick actions</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {can("expense.submit") && <button style={linkButton} onClick={() => setReimbursementOpen(true)}>+ New expense</button>}
          {can("project.submit_expense") && <button style={linkButtonSecondary} onClick={() => setProjectExpenseOpen(true)}>Project expense</button>}
          {queues.length > 0 && <Link to="/expenses/approvals" style={linkButtonSecondary}>Review approvals</Link>}
        </div>
      </section>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Expense management</h2>
        <div style={cardGrid}>
          <ModuleCard to="/my-expenses" title="My Expenses" description="Everything you've submitted, any status." />
          {queues.length > 0 && <ModuleCard to="/expenses/approvals" title="Approvals" description="Reimbursements and project expenses waiting on you." />}
          {can("expense.view") && <ModuleCard to="/reimbursement" title="Reimbursement" description="Personal reimbursement claims and approval history." />}
          {can("project.view") && <ModuleCard to="/projects/expenses" title="Project Expenses" description="Costs tagged to a specific project." />}
        </div>
      </section>

      <Drawer open={reimbursementOpen} title="Submit reimbursement" onClose={() => setReimbursementOpen(false)}>
        <SubmitReimbursementForm onDone={() => setReimbursementOpen(false)} />
      </Drawer>
      <Drawer open={projectExpenseOpen} title="Submit project expense" onClose={() => setProjectExpenseOpen(false)}>
        <SubmitProjectExpenseForm onDone={() => setProjectExpenseOpen(false)} />
      </Drawer>
    </div>
  );
}

function ModuleCard({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link to={to} className="card-surface" style={moduleCard}>
      <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{description}</div>
    </Link>
  );
}

const cardGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14,
};

const moduleCard: React.CSSProperties = {
  textDecoration: "none", display: "block", background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
  padding: 16, boxShadow: "var(--shadow)",
};

const linkButton: React.CSSProperties = {
  textDecoration: "none", background: "var(--accent)", color: "var(--accent-ink)",
  fontWeight: 700, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--radius)",
  border: "none", cursor: "pointer", font: "inherit",
};

const linkButtonSecondary: React.CSSProperties = {
  textDecoration: "none", background: "var(--surface-sunken)", color: "var(--ink)",
  fontWeight: 600, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--radius)",
  border: "1px solid var(--border)", cursor: "pointer", font: "inherit",
};

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";
import { pageStyles as s } from "../styles/pageKit";

interface ProjectRow {
  id: string;
  status: string;
  budgetAmount: number | null;
}

interface ExpenseRow { id: string }

// The Projects module's command center: how many projects are live, what's waiting on an
// expense decision, and every capability inside the module — instead of landing straight on
// the directory table with no sense of what needs attention.
export default function ProjectsOverview() {
  const { can } = useAuth();

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectRow[]>("/projects")).data,
    enabled: can("project.view"),
  });

  const pmQueue = useQuery({
    queryKey: ["project-expenses", "pending-pm-approval"],
    queryFn: async () => (await api.get<ExpenseRow[]>("/project-expenses/pending-pm-approval")).data,
    enabled: can("project.approve_expense_as_pm"),
  });

  const financeQueue = useQuery({
    queryKey: ["project-expenses", "pending-finance-approval"],
    queryFn: async () => (await api.get<ExpenseRow[]>("/project-expenses/pending-finance-approval")).data,
    enabled: can("project.approve_expense_as_finance"),
  });

  const activeCount = projects.data?.filter((p) => p.status === "Active").length;
  const totalBudget = projects.data?.reduce((sum, p) => sum + (p.budgetAmount ?? 0), 0);
  const pendingExpenseCount = (pmQueue.data?.length ?? 0) + (financeQueue.data?.length ?? 0);
  const hasExpenseApprovals = can("project.approve_expense_as_pm") || can("project.approve_expense_as_finance");

  const isLoading = projects.isFetching;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Projects</h1>
          <p style={s.subtitle}>Every project, its budget, and what's waiting on a decision.</p>
        </div>
      </header>

      {isLoading && <Spinner />}

      <div style={s.statGrid}>
        {projects.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Active projects</div>
            <div style={s.statValue}>{activeCount}</div>
          </div>
        )}
        {projects.isSuccess && totalBudget !== undefined && totalBudget > 0 && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Total budget</div>
            <div style={s.statValue}>{totalBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>
          </div>
        )}
        {hasExpenseApprovals && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending expense approvals</div>
            <div style={s.statValue}>{pendingExpenseCount}</div>
          </div>
        )}
      </div>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Quick actions</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {can("project.manage_budget") && <Link to="/projects/create" style={linkButton}>+ New project</Link>}
          {can("project.view") && <Link to="/projects/team" style={linkButtonSecondary}>Staff a project</Link>}
          {can("project.submit_expense") && <Link to="/projects/expenses" style={linkButtonSecondary}>Submit project expense</Link>}
          {hasExpenseApprovals && <Link to="/projects/expenses" style={linkButtonSecondary}>Review expenses</Link>}
        </div>
      </section>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Project management</h2>
        <div style={cardGrid}>
          <ModuleCard to="/projects" title="All Projects" description="Every project in the organization." />
          {can("project.manage_budget") && <ModuleCard to="/projects/planning" title="Project Planning" description="Timeline, status, and milestones." />}
          {can("project.view") && <ModuleCard to="/projects/team" title="Project Team" description="Staffing, tasks, and per-project rates." />}
          {can("project.view") && <ModuleCard to="/projects/tasks" title="My Tasks" description="Every task assigned to you, across every project." />}
          {can("project.view") && <ModuleCard to="/projects/progress" title="Project Progress" description="Time elapsed and budget burn." />}
          {can("project.view") && <ModuleCard to="/projects/budget" title="Project Budget" description="Approved, pending, and remaining spend." />}
          {can("project.view") && <ModuleCard to="/projects/profitability" title="Profitability" description="Revenue vs. cost by month." />}
        </div>
      </section>
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
};

const linkButtonSecondary: React.CSSProperties = {
  textDecoration: "none", background: "var(--surface-sunken)", color: "var(--ink)",
  fontWeight: 600, fontSize: 13.5, padding: "10px 16px", borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
};

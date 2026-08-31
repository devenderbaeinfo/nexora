import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";

export default function ReportsOverview() {
  const { can } = useAuth();

  const sections = [
    can("leave.approve_as_manager") && { to: "/reports/team", label: "Team Reports", description: "Headcount, attendance, and leave utilization for your team." },
    can("project.view") && { to: "/reports/projects", label: "Project Reports", description: "Budget vs. actual and cost by employee, across every project." },
    can("expense.approve_as_manager") && { to: "/reports/expenses", label: "Expense Reports", description: "Reimbursement trends and turnaround time." },
  ].filter((s): s is { to: string; label: string; description: string } => Boolean(s));

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Reports</h1>
          <p style={s.subtitle}>Workforce, project, and expense reporting in one place.</p>
        </div>
      </header>

      {sections.length === 0 && <p style={s.muted}>No reports available for your role yet.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {sections.map((section) => (
          <Link key={section.to} to={section.to} style={cardLink} className="card-surface">
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>{section.label}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{section.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const cardLink: React.CSSProperties = {
  textDecoration: "none", display: "block", background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
  padding: 16, boxShadow: "var(--shadow)",
};

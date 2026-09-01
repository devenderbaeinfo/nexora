import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";
import { pageStyles as s } from "../styles/pageKit";

interface EmployeeListItem {
  id: string;
  status: string;
}

interface HrTrends {
  headcount: { label: string; count: number }[];
  attendance: { label: string; present: number; total: number }[];
}

interface OnboardingTaskRow { employeeId: string }
interface FnfCaseRow { id: string }
interface LeaveRequestRow { id: string }

// The People module's command center: land here on "People" (not straight into the
// directory table), see what needs attention, and jump into whichever capability actually
// applies — rather than only ever landing on a flat employee list with no context.
export default function PeopleOverview() {
  const { can } = useAuth();

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: can("people.view"),
  });

  const trends = useQuery({
    queryKey: ["dashboard", "hr-trends"],
    queryFn: async () => (await api.get<HrTrends>("/dashboard/hr-trends")).data,
    enabled: can("attendance.view_all"),
  });

  const pendingLeave = useQuery({
    queryKey: ["leave-requests", "pending-hr-approval"],
    queryFn: async () => (await api.get<LeaveRequestRow[]>("/leave-requests/pending-hr-approval")).data,
    enabled: can("leave.approve_as_hr"),
  });

  const onboarding = useQuery({
    queryKey: ["onboarding", "all"],
    queryFn: async () => (await api.get<OnboardingTaskRow[]>("/onboarding")).data,
    enabled: can("onboarding.manage"),
  });

  const fnf = useQuery({
    queryKey: ["fnf", "all"],
    queryFn: async () => (await api.get<FnfCaseRow[]>("/fnf")).data,
    enabled: can("fnf.manage"),
  });

  const activeCount = employees.data?.filter((e) => e.status === "Active").length;
  const latestAttendance = trends.data?.attendance.at(-1);

  const isLoading = employees.isLoading || trends.isFetching;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>People</h1>
          <p style={s.subtitle}>Employees, attendance, leave, and lifecycle — everything HR needs, in one place.</p>
        </div>
      </header>

      {isLoading && <Spinner />}

      <div style={s.statGrid}>
        {employees.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Active employees</div>
            <div style={s.statValue}>{activeCount}</div>
          </div>
        )}
        {latestAttendance && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Present today</div>
            <div style={s.statValue}>{latestAttendance.present}/{latestAttendance.total}</div>
          </div>
        )}
        {pendingLeave.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending leave approvals</div>
            <div style={s.statValue}>{pendingLeave.data.length}</div>
          </div>
        )}
        {onboarding.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Onboarding in progress</div>
            <div style={s.statValue}>{new Set(onboarding.data.map((t) => t.employeeId)).size}</div>
          </div>
        )}
        {fnf.isSuccess && (
          <div style={s.statCard}>
            <div style={s.statLabel}>Settlements in progress</div>
            <div style={s.statValue}>{fnf.data.length}</div>
          </div>
        )}
      </div>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Quick actions</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {can("people.view") && <Link to="/" style={linkButton}>+ Add employee</Link>}
          {can("leave.approve_as_hr") && <Link to="/timecard" style={linkButtonSecondary}>Review leave requests</Link>}
          {can("onboarding.manage") && <Link to="/onboarding" style={linkButtonSecondary}>Start onboarding</Link>}
          {can("fnf.manage") && <Link to="/fnf" style={linkButtonSecondary}>Full & Final Settlement</Link>}
        </div>
      </section>

      <section style={{ ...s.section, marginTop: 28 }}>
        <h2 style={s.sectionTitle}>Capabilities</h2>
        <div style={cardGrid}>
          {can("people.view") && <ModuleCard to="/" title="Employee Directory" description="Search, filter, and manage every employee record." />}
          {can("people.manage") && <ModuleCard to="/job-titles" title="Job Titles" description="Titles and the system role each one grants." />}
          {can("attendance.clock_in_out") && <ModuleCard to="/attendance" title="Attendance" description="Clock-ins, clock-outs, and daily attendance." />}
          {can("timesheet.view") && <ModuleCard to="/timecard" title="Leave" description="Requests, balances, and approvals." />}
          {can("leave.configure_policy") && <ModuleCard to="/leave-types" title="Leave Types" description="Leave policies and annual allowances." />}
          {can("onboarding.view") && <ModuleCard to="/onboarding" title="Onboarding" description="New-hire checklists from paperwork to first day." />}
          {can("employee_docs.view") && <ModuleCard to="/documents" title="Documents" description="Offer letters, contracts, and ID proofs." />}
          {can("fnf.view") && <ModuleCard to="/fnf" title="Full & Final Settlement" description="Exit clearance and final payout." />}
          {(can("payroll.manage") || can("payroll.approve")) && <ModuleCard to="/payroll/runs" title="Payroll" description="Salary structures, monthly runs, and payslips." />}
          <ModuleCard to="/announcements" title="Announcements & Policies" description="Company-wide announcements and policy documents." />
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

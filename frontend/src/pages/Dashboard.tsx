import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import TrendChart from "../components/TrendChart";
import ActionCenter, { useActionGroups } from "../components/ActionCenter";

interface DashboardSummary {
  teamSize: number;
  pendingLeaveApprovals: number;
  pendingExpenseApprovals: number;
  pendingProjectExpenseApprovals: number;
  managedProjectsCount: number;
  managedProjectsBudgetTotal: number;
  managedProjectsSpentTotal: number;
}

interface HeadcountPoint { month: string; count: number; }
interface AttendancePoint { date: string; present: number; activeEmployees: number; }
interface HrTrends { headcount: HeadcountPoint[]; attendance: AttendancePoint[]; }

interface EmployeeListItem { id: string; status: string; }
interface OnboardingTaskRow { employeeId: string; }
interface FnfCaseRow { id: string; }
interface LeaveRequestRow { id: string; }

export default function Dashboard() {
  const { can } = useAuth();
  const { groups: actionGroups } = useActionGroups();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => (await api.get<DashboardSummary>("/dashboard/summary")).data,
  });

  const hrTrends = useQuery({
    queryKey: ["dashboard", "hr-trends"],
    queryFn: async () => (await api.get<HrTrends>("/dashboard/hr-trends")).data,
    enabled: can("attendance.view_all"),
  });

  // /dashboard/summary is scoped to the caller's own direct reports and managed projects —
  // an HR/Admin account typically has neither, so every card above would be a genuine zero,
  // not a bug. These org-wide numbers (same source as the People module's own overview) are
  // what actually make this page useful for that account instead of an all-zero dead end.
  const orgEmployees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: can("people.view"),
  });
  const pendingHrLeave = useQuery({
    queryKey: ["leave-requests", "pending-hr-approval"],
    queryFn: async () => (await api.get<LeaveRequestRow[]>("/leave-requests/pending-hr-approval")).data,
    enabled: can("leave.approve_as_hr"),
  });
  const onboardingInProgress = useQuery({
    queryKey: ["onboarding", "all"],
    queryFn: async () => (await api.get<OnboardingTaskRow[]>("/onboarding")).data,
    enabled: can("onboarding.manage"),
  });
  const fnfInProgress = useQuery({
    queryKey: ["fnf", "all"],
    queryFn: async () => (await api.get<FnfCaseRow[]>("/fnf")).data,
    enabled: can("fnf.manage"),
  });
  const hasOrgStats = orgEmployees.isSuccess || pendingHrLeave.isSuccess || onboardingInProgress.isSuccess || fnfInProgress.isSuccess;

  const currency = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Dashboard</h1>
          <p style={s.subtitle}>Your team and projects at a glance.</p>
        </div>
      </header>

      {isLoading && <Spinner />}

      <ActionCenter groups={actionGroups} />

      {hasOrgStats && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={s.sectionTitle}>Organization</h2>
          <div style={s.statGrid}>
            {orgEmployees.isSuccess && (
              <Link to="/people" style={{ textDecoration: "none" }}>
                <div style={s.statCard}>
                  <div style={s.statLabel}>Active employees</div>
                  <div style={s.statValue}>{orgEmployees.data.filter((e) => e.status === "Active").length}</div>
                </div>
              </Link>
            )}
            {pendingHrLeave.isSuccess && (
              <Link to="/timecard" style={{ textDecoration: "none" }}>
                <div style={s.statCard}>
                  <div style={s.statLabel}>Pending HR leave approvals</div>
                  <div style={s.statValue}>{pendingHrLeave.data.length}</div>
                </div>
              </Link>
            )}
            {onboardingInProgress.isSuccess && (
              <Link to="/onboarding" style={{ textDecoration: "none" }}>
                <div style={s.statCard}>
                  <div style={s.statLabel}>Onboarding in progress</div>
                  <div style={s.statValue}>{new Set(onboardingInProgress.data.map((t) => t.employeeId)).size}</div>
                </div>
              </Link>
            )}
            {fnfInProgress.isSuccess && (
              <Link to="/fnf" style={{ textDecoration: "none" }}>
                <div style={s.statCard}>
                  <div style={s.statLabel}>Settlements in progress</div>
                  <div style={s.statValue}>{fnfInProgress.data.length}</div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {data && (hasManagerStats(data) || !hasOrgStats) && (
        <>
          <h2 style={s.sectionTitle}>Your team & projects</h2>
          <div style={s.statGrid}>
            <Link to="/my-team" style={{ textDecoration: "none" }}>
              <div style={s.statCard}>
                <div style={s.statLabel}>Team size</div>
                <div style={s.statValue}>{data.teamSize}</div>
              </div>
            </Link>
            <Link to="/approvals" style={{ textDecoration: "none" }}>
              <div style={s.statCard}>
                <div style={s.statLabel}>Pending leave approvals</div>
                <div style={s.statValue}>{data.pendingLeaveApprovals}</div>
              </div>
            </Link>
            <Link to="/expenses/approvals" style={{ textDecoration: "none" }}>
              <div style={s.statCard}>
                <div style={s.statLabel}>Pending expense approvals</div>
                <div style={s.statValue}>{data.pendingExpenseApprovals}</div>
              </div>
            </Link>
            <Link to="/expenses/approvals" style={{ textDecoration: "none" }}>
              <div style={s.statCard}>
                <div style={s.statLabel}>Pending project expenses</div>
                <div style={s.statValue}>{data.pendingProjectExpenseApprovals}</div>
              </div>
            </Link>
            <Link to="/projects" style={{ textDecoration: "none" }}>
              <div style={s.statCard}>
                <div style={s.statLabel}>Projects you manage</div>
                <div style={s.statValue}>{data.managedProjectsCount}</div>
              </div>
            </Link>
          </div>

          {data.managedProjectsCount > 0 && (
            <section style={{ ...s.section, marginTop: 28 }}>
              <h2 style={s.sectionTitle}>Managed projects budget</h2>
              <div style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
                  <span>{currency(data.managedProjectsSpentTotal)} spent</span>
                  <span style={s.muted}>of {currency(data.managedProjectsBudgetTotal)} budget</span>
                </div>
                <div style={s.progressTrack}>
                  <div style={{
                    height: "100%",
                    width: `${data.managedProjectsBudgetTotal === 0 ? 0 : Math.min(100, (data.managedProjectsSpentTotal / data.managedProjectsBudgetTotal) * 100)}%`,
                    background: "var(--accent)", borderRadius: 20,
                  }} />
                </div>
              </div>
            </section>
          )}

          {can("attendance.view_all") && hrTrends.data && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 28, alignItems: "start" }}>
              <section style={s.card}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Headcount</h2>
                <p style={{ ...s.muted, marginBottom: 16 }}>Active employees, last 6 months.</p>
                <TrendChart
                  labels={hrTrends.data.headcount.map((p) => p.month)}
                  series={[{ name: "Headcount", color: "var(--accent)", values: hrTrends.data.headcount.map((p) => p.count) }]}
                  fillArea
                />
              </section>

              <section style={s.card}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Attendance rate</h2>
                <p style={{ ...s.muted, marginBottom: 16 }}>Share of active employees clocked in each day, last 14 days.</p>
                <TrendChart
                  labels={hrTrends.data.attendance.map((p) => p.date)}
                  series={[{
                    name: "Present",
                    color: "var(--teal)",
                    values: hrTrends.data.attendance.map((p) => p.activeEmployees === 0 ? 0 : Math.round((p.present / p.activeEmployees) * 100)),
                  }]}
                  formatValue={(n) => `${n}%`}
                  fillArea
                />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function hasManagerStats(data: DashboardSummary) {
  return data.teamSize > 0 || data.pendingLeaveApprovals > 0 || data.pendingExpenseApprovals > 0
    || data.pendingProjectExpenseApprovals > 0 || data.managedProjectsCount > 0;
}

import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, statTrend, progressFill } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import TrendChart from "../components/TrendChart";
import DonutChart from "../components/DonutChart";
import ActionCenter, { useActionGroups } from "../components/ActionCenter";
import { formatCurrency } from "../lib/currency";
import { iconForLabel } from "../components/icons";
import { timeAgo } from "../components/NotificationsBell";
import { DashboardAtmosphere, BrandVisual } from "./DashboardArt";
import "./dashboard.css";

const KPI_TINTS = ["tint-mint", "tint-peach", "tint-blush", "tint-lavender"];

function KpiCard({
  to, label, value, index, deltaPercent,
}: { to: string; label: string; value: number | string; index: number; deltaPercent?: number | null }) {
  return (
    <Link to={to} className={`glass-panel kpi-glass ${KPI_TINTS[index % KPI_TINTS.length]}`}>
      {/* Decorative echo of the small icon below, enlarged and near-invisible — never a
          second data point, purely the reference theme's corner-watermark treatment. */}
      <span className="kpi-ghost-icon">{iconForLabel(label, 64)}</span>
      <div className="kpi-glass-inner">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="kpi-icon">{iconForLabel(label, 17)}</span>
          {typeof deltaPercent === "number" && (
            <span style={statTrend(deltaPercent)}>{deltaPercent >= 0 ? "▲" : "▼"} {Math.abs(deltaPercent)}%</span>
          )}
        </div>
        <div style={s.statValue}>{value}</div>
        <div style={s.statLabel}>{label}</div>
        {typeof deltaPercent === "number" && (
          <div style={s.progressTrack}>
            <div style={progressFill(50 + Math.max(-50, Math.min(50, deltaPercent * 3)), deltaPercent < 0)} />
          </div>
        )}
      </div>
    </Link>
  );
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const QUOTES = [
  "A more organized tomorrow starts today.",
  "Clarity is the foundation of good decisions.",
  "Small, consistent progress beats occasional bursts.",
  "The best process is the one everyone can see.",
];

function quoteOfTheDay() {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return QUOTES[dayIndex % QUOTES.length];
}

const glassCard: CSSProperties = { padding: 20 };

const DONUT_COLORS = ["var(--accent)", "var(--teal)", "var(--gold)", "var(--accent-light)", "var(--danger)", "var(--muted)"];

interface AuditLogRow {
  id: string; createdAtUtc: string; actorName: string | null;
  action: string; entityType: string; entityId: string | null; wasDenied: boolean;
}

interface ExpenseCategory { category: string; amount: number; }
interface UpcomingLeave { employeeName: string; startDate: string; endDate: string; days: number; }
interface DashboardKpis {
  totalEmployees: number | null; totalEmployeesDeltaPercent: number | null;
  onLeaveToday: number | null;
  expensesMtd: number | null; expensesMtdDeltaPercent: number | null;
  expenseByCategory: ExpenseCategory[] | null;
  payrollCostMtd: number | null; payrollCostMtdDeltaPercent: number | null;
  upcomingLeaves: UpcomingLeave[] | null;
  baseCurrency: string | null;
}

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
interface LeadRow { id: string; stage: string; }
interface PurchaseOrderRow { id: string; status: string; }
interface StockItemRow { id: string; quantityOnHand: number; reorderLevel: number; }
interface ContactRow { id: string; }

export default function Dashboard() {
  const { can, user } = useAuth();
  const { groups: actionGroups } = useActionGroups();

  const kpis = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => (await api.get<DashboardKpis>("/dashboard/kpis")).data,
  });

  const recentActivity = useQuery({
    queryKey: ["audit-log", "recent"],
    queryFn: async () => (await api.get<AuditLogRow[]>("/audit-log", { params: { take: 6 } })).data,
    enabled: can("admin.view_audit_log"),
  });

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

  const leads = useQuery({
    queryKey: ["sales", "leads"],
    queryFn: async () => (await api.get<LeadRow[]>("/sales/leads")).data,
    enabled: can("sales.view"),
  });
  const purchaseOrders = useQuery({
    queryKey: ["procurement", "purchase-orders"],
    queryFn: async () => (await api.get<PurchaseOrderRow[]>("/procurement/purchase-orders")).data,
    enabled: can("procurement.view"),
  });
  const stockItems = useQuery({
    queryKey: ["inventory", "stock-items"],
    queryFn: async () => (await api.get<StockItemRow[]>("/inventory/stock-items")).data,
    enabled: can("inventory.view"),
  });
  const contacts = useQuery({
    queryKey: ["crm", "contacts"],
    queryFn: async () => (await api.get<ContactRow[]>("/crm/contacts")).data,
    enabled: can("crm.view"),
  });
  const hasSalesOpsStats = leads.isSuccess || purchaseOrders.isSuccess || stockItems.isSuccess || contacts.isSuccess;

  const currency = formatCurrency;
  const k = kpis.data;
  const hasAnyKpi = k && (k.totalEmployees != null || k.onLeaveToday != null || k.expensesMtd != null || k.payrollCostMtd != null);

  const quickActions = [
    { label: "Add Employee", to: "/people", show: can("people.manage") },
    { label: "Approve Leave", to: "/approvals", show: can("leave.approve_as_manager") || can("leave.approve_as_hr") },
    { label: "Add Expense", to: "/reimbursement", show: can("expense.view") },
    { label: "View Reports", to: "/reports", show: can("project.view") || can("leave.approve_as_manager") },
  ].filter((a) => a.show);

  return (
    <div className="dashboard-glass">
      <DashboardAtmosphere />
      <div className="dashboard-content">
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch", marginBottom: 24 }}>
          <div style={{ flex: "2 1 320px" }}>
            <h1 style={s.title}>{timeOfDayGreeting()}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} 👋</h1>
            <p style={s.subtitle}>Here's what's happening in your organization today.</p>
          </div>
          <div className="glass-panel quote-card" style={{ ...glassCard, flex: "1 1 220px", display: "flex", alignItems: "center" }}>
            "{quoteOfTheDay()}"
          </div>
          <div className="glass-panel" style={{ ...glassCard, flex: "0 0 auto", minWidth: 180 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Have a productive day!</div>
          </div>
        </div>

        {isLoading && <Spinner />}

        <ActionCenter groups={actionGroups} />

        {hasAnyKpi && (
          <section style={{ marginBottom: 24 }}>
            <div style={s.statGrid}>
              {k!.totalEmployees != null && (
                <KpiCard index={0} to="/people" label="Total Employees" value={k!.totalEmployees} deltaPercent={k!.totalEmployeesDeltaPercent} />
              )}
              {k!.onLeaveToday != null && (
                <KpiCard index={1} to="/attendance" label="On Leave Today" value={k!.onLeaveToday} />
              )}
              {k!.expensesMtd != null && (
                <KpiCard index={2} to="/expenses/approvals" label="Total Expenses (MTD)" value={currency(k!.expensesMtd)} deltaPercent={k!.expensesMtdDeltaPercent} />
              )}
              {k!.payrollCostMtd != null && (
                <KpiCard index={3} to="/payroll/runs" label="Payroll Cost (MTD)" value={currency(k!.payrollCostMtd)} deltaPercent={k!.payrollCostMtdDeltaPercent} />
              )}
            </div>
          </section>
        )}

        {(() => {
          const hasAttendance = can("attendance.view_all") && !!hrTrends.data;
          const hasExpenseBreakdown = !!(k?.expenseByCategory && k.expenseByCategory.length > 0);
          const hasQuickActions = quickActions.length > 0;
          const middleColumnCount = [hasAttendance, hasExpenseBreakdown, hasQuickActions].filter(Boolean).length;
          if (middleColumnCount === 0) return null;

          const middleColumns = hasAttendance
            ? (hasExpenseBreakdown && hasQuickActions ? "2fr 1fr 1fr" : hasExpenseBreakdown || hasQuickActions ? "2fr 1fr" : "1fr")
            : `repeat(${middleColumnCount}, 1fr)`;

          return (
            <div style={{ display: "grid", gridTemplateColumns: middleColumns, gap: 20, marginBottom: 24, alignItems: "start" }}>
              {hasAttendance && (
                <section className="glass-panel" style={glassCard}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Employee Attendance</h2>
                  <p style={{ ...s.muted, marginBottom: 16 }}>Share of active employees present, last 14 days.</p>
                  <TrendChart
                    labels={hrTrends.data!.attendance.map((p) => p.date)}
                    series={[{
                      name: "Present", color: "var(--teal)",
                      values: hrTrends.data!.attendance.map((p) => p.activeEmployees === 0 ? 0 : Math.round((p.present / p.activeEmployees) * 100)),
                    }]}
                    formatValue={(n) => `${n}%`}
                    fillArea
                  />
                </section>
              )}

              {hasExpenseBreakdown && (
                <section className="glass-panel" style={glassCard}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Expense Breakdown</h2>
                  <p style={{ ...s.muted, marginBottom: 16 }}>This month, by category.</p>
                  <DonutChart
                    centerLabel="Total"
                    formatValue={currency}
                    slices={k!.expenseByCategory!.map((c, i) => ({ label: c.category, value: c.amount, color: DONUT_COLORS[i % DONUT_COLORS.length] }))}
                  />
                </section>
              )}

              {hasQuickActions && (
                <section className="glass-panel" style={glassCard}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Quick Actions</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {quickActions.map((a) => (
                      <Link key={a.label} to={a.to} className="glass-panel" style={{ padding: 12, fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
                        <div style={{ color: "var(--accent)", marginBottom: 6 }}>{iconForLabel(a.label, 18)}</div>
                        {a.label}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        })()}

        {(() => {
          const hasRecentActivity = can("admin.view_audit_log");
          const hasUpcomingLeaves = !!k?.upcomingLeaves;
          if (!hasRecentActivity && !hasUpcomingLeaves) return null;
          const columns = hasRecentActivity && hasUpcomingLeaves ? "2fr 1fr" : "1fr";

          return (
            <div style={{ display: "grid", gridTemplateColumns: columns, gap: 20, marginBottom: 24, alignItems: "start" }}>
              {hasRecentActivity && (
                <section className="glass-panel" style={glassCard}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Recent Activity</h2>
                  {recentActivity.data && recentActivity.data.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {recentActivity.data.map((row) => (
                        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                          <span style={{ color: "var(--ink)" }}>
                            {row.actorName ?? "Someone"} — {row.action.replace(/[._]/g, " ")}
                          </span>
                          <span style={{ color: "var(--faint)", whiteSpace: "nowrap", fontSize: 11.5 }}>{timeAgo(row.createdAtUtc)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={s.muted}>Nothing recorded yet.</p>
                  )}
                </section>
              )}

              {hasUpcomingLeaves && (
                <section className="glass-panel" style={glassCard}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Upcoming Leaves</h2>
                  {k!.upcomingLeaves!.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {k!.upcomingLeaves!.map((l, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                          <span style={{ color: "var(--ink)" }}>{l.employeeName}</span>
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>{l.startDate}{l.startDate !== l.endDate ? ` – ${l.endDate}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={s.muted}>No upcoming approved leave.</p>
                  )}
                </section>
              )}
            </div>
          );
        })()}

        {hasOrgStats && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={s.sectionTitle}>Organization</h2>
            <div style={s.statGrid}>
              {orgEmployees.isSuccess && (
                <KpiCard index={0} to="/people" label="Active employees" value={orgEmployees.data.filter((e) => e.status === "Active").length} />
              )}
              {pendingHrLeave.isSuccess && (
                <KpiCard index={1} to="/timecard" label="Pending HR leave approvals" value={pendingHrLeave.data.length} />
              )}
              {onboardingInProgress.isSuccess && (
                <KpiCard index={2} to="/onboarding" label="Onboarding in progress" value={new Set(onboardingInProgress.data.map((t) => t.employeeId)).size} />
              )}
              {fnfInProgress.isSuccess && (
                <KpiCard index={3} to="/fnf" label="Settlements in progress" value={fnfInProgress.data.length} />
              )}
            </div>
          </section>
        )}

        {hasSalesOpsStats && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={s.sectionTitle}>Sales & Operations</h2>
            <div style={s.statGrid}>
              {leads.isSuccess && (
                <KpiCard index={0} to="/sales/leads" label="Open leads" value={leads.data.filter((l) => l.stage !== "Won" && l.stage !== "Lost").length} />
              )}
              {purchaseOrders.isSuccess && (
                <KpiCard index={1} to="/procurement/purchase-orders" label="Pending purchase orders" value={purchaseOrders.data.filter((o) => o.status !== "Received").length} />
              )}
              {stockItems.isSuccess && (
                <KpiCard index={2} to="/inventory/stock-items" label="Low stock items" value={stockItems.data.filter((i) => i.quantityOnHand <= i.reorderLevel).length} />
              )}
              {contacts.isSuccess && (
                <KpiCard index={3} to="/crm/contacts" label="Total contacts" value={contacts.data.length} />
              )}
            </div>
          </section>
        )}

        {data && (hasManagerStats(data) || !hasOrgStats) && (
          <>
            <h2 style={s.sectionTitle}>Your team & projects</h2>
            <div style={s.statGrid}>
              <KpiCard index={0} to="/my-team" label="Team size" value={data.teamSize} />
              <KpiCard index={1} to="/approvals" label="Pending leave approvals" value={data.pendingLeaveApprovals} />
              <KpiCard index={2} to="/expenses/approvals" label="Pending expense approvals" value={data.pendingExpenseApprovals} />
              <KpiCard index={3} to="/expenses/approvals" label="Pending project expenses" value={data.pendingProjectExpenseApprovals} />
              <KpiCard index={0} to="/projects" label="Projects you manage" value={data.managedProjectsCount} />
            </div>

            {data.managedProjectsCount > 0 && (
              <section style={{ ...s.section, marginTop: 24 }}>
                <h2 style={s.sectionTitle}>Managed projects budget</h2>
                <div className="glass-panel" style={glassCard}>
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
              <section className="glass-panel" style={{ ...glassCard, marginTop: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Headcount</h2>
                <p style={{ ...s.muted, marginBottom: 16 }}>Active employees, last 6 months.</p>
                <TrendChart
                  labels={hrTrends.data.headcount.map((p) => p.month)}
                  series={[{ name: "Headcount", color: "var(--accent)", values: hrTrends.data.headcount.map((p) => p.count) }]}
                  fillArea
                />
              </section>
            )}
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
          <div className="glass-panel brand-card">
            <BrandVisual variant="a" />
            <div className="brand-content">
              <h3>Smarter Operations.<br />Clearer Decisions.</h3>
              <p>One connected view of your people, process and progress.</p>
            </div>
          </div>
          <div className="glass-panel brand-card">
            <BrandVisual variant="b" />
            <div className="brand-content">
              <h3>Operational Clarity.<br />Real Progress.</h3>
              <p>Every team, every approval, every number — in one place.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function hasManagerStats(data: DashboardSummary) {
  return data.teamSize > 0 || data.pendingLeaveApprovals > 0 || data.pendingExpenseApprovals > 0
    || data.pendingProjectExpenseApprovals > 0 || data.managedProjectsCount > 0;
}

import { useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import AnnouncementBanner from "./AnnouncementBanner";
import NotificationsBell from "./NotificationsBell";
import CommandPalette from "./CommandPalette";
import { iconForLabel } from "./icons";

type Can = (permission: string) => boolean;
type NavItem = { to: string; label: string; show: (can: Can) => boolean };
type NavGroup = { section: string; items: NavItem[] };

const canApproveAnyExpense = (can: Can) =>
  can("expense.approve_as_manager") || can("expense.approve_as_finance") ||
  can("project.approve_expense_as_pm") || can("project.approve_expense_as_finance");
const canApproveAnything = (can: Can) =>
  can("leave.approve_as_manager") || can("leave.approve_as_hr") || canApproveAnyExpense(can);

// The Manager role gets its own fixed nav — a manager's job here is running their team and
// projects, not the HR/tenant-admin surface, so this list is deliberately closed rather than
// permission-filtered from the shared set below.
const MANAGER_NAV_GROUPS: NavGroup[] = [
  {
    section: "",
    items: [
      { to: "/my-team", label: "My Team", show: () => true },
      { to: "/attendance", label: "Attendance", show: () => true },
      { to: "/timecard", label: "Leave Approval", show: () => true },
      { to: "/timesheets/approval", label: "Timesheet Approval", show: () => true },
    ],
  },
  {
    section: "Projects",
    items: [
      // Create, staffing, and tasks all live on the one Projects workspace now (a project card
      // grid → pick one → team + tasks + budget together) instead of three separate pages.
      { to: "/projects/team", label: "Projects", show: () => true },
      { to: "/projects/progress", label: "Progress", show: () => true },
      { to: "/projects/profitability", label: "Profitability", show: () => true },
    ],
  },
  {
    section: "Expenses",
    items: [
      { to: "/expenses/team", label: "Team Expenses", show: () => true },
      { to: "/projects/expenses", label: "Project Expenses", show: () => true },
      { to: "/expenses/approvals", label: "Approvals", show: () => true },
    ],
  },
  {
    section: "",
    items: [
      { to: "/my-profile", label: "My Profile", show: () => true },
      { to: "/my-time", label: "My Time", show: () => true },
      { to: "/timecard", label: "My Leave", show: () => true },
      { to: "/projects/mine", label: "My Projects", show: () => true },
      { to: "/my-expenses", label: "My Expenses", show: () => true },
    ],
  },
  {
    section: "Reports",
    items: [
      { to: "/reports/team", label: "Team Reports", show: () => true },
      { to: "/reports/projects", label: "Project Reports", show: () => true },
      { to: "/reports/expenses", label: "Expense Reports", show: () => true },
    ],
  },
];

// The Finance role gets its own fixed nav too — expense verification, the accounting
// core (Chart of Accounts/Journal Entries/Ledger/Trial Balance/Bank/Cash), project cost
// views, and financial reports. No AP/AR vendor-bill workflows or tax reports yet —
// those need business rules (payment terms, tax codes) that haven't been defined.
const FINANCE_NAV_GROUPS: NavGroup[] = [
  {
    section: "",
    items: [{ to: "/finance/dashboard", label: "Dashboard", show: () => true }],
  },
  {
    section: "Expenses",
    items: [
      { to: "/reimbursement", label: "Employee Reimbursements", show: () => true },
      { to: "/projects/expenses", label: "Project Expenses", show: () => true },
      { to: "/expenses/approvals", label: "Expense Verification", show: () => true },
    ],
  },
  {
    section: "Projects",
    // One workspace: pick a project from the list, see budget, cost, and profitability
    // together — instead of four separate pages each re-selecting the same project.
    items: [{ to: "/finance/projects", label: "Projects", show: () => true }],
  },
  {
    section: "Reports",
    items: [
      { to: "/accounting/profit-and-loss", label: "P&L", show: () => true },
      { to: "/accounting/balance-sheet", label: "Balance Sheet", show: () => true },
      { to: "/accounting/cash-flow", label: "Cash Flow", show: () => true },
      { to: "/reports/expenses-all", label: "Expense Reports", show: () => true },
    ],
  },
];

// The Employee role gets its own fixed, self-service-only nav — same idea as Manager's:
// closed rather than permission-filtered from the shared set.
const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    section: "",
    items: [
      { to: "/my-profile", label: "My Profile", show: () => true },
      { to: "/attendance", label: "My Time", show: () => true },
      { to: "/timecard", label: "My Leave", show: () => true },
      { to: "/projects/mine", label: "My Projects", show: () => true },
      { to: "/my-expenses", label: "My Expenses", show: () => true },
    ],
  },
];

// perm: null means "every authenticated tenant user sees this" — no permission gate.
const DEFAULT_NAV_GROUPS: NavGroup[] = [
  {
    section: "Main",
    items: [{ to: "/dashboard", label: "Dashboard", show: () => true }],
  },
  {
    section: "My Team",
    items: [
      { to: "/attendance", label: "Attendance", show: (can) => can("attendance.clock_in_out") },
      { to: "/timecard", label: "Leave", show: (can) => can("timesheet.view") },
    ],
  },
  {
    section: "Projects",
    items: [
      { to: "/projects", label: "All Projects", show: (can) => can("project.view") },
      { to: "/projects/create", label: "Create Project", show: (can) => can("project.manage_budget") },
      { to: "/projects/planning", label: "Project Planning", show: (can) => can("project.manage_budget") },
      { to: "/projects/team", label: "Project Team", show: (can) => can("project.view") },
      { to: "/projects/tasks", label: "Project Tasks", show: (can) => can("project.view") },
      { to: "/projects/progress", label: "Project Progress", show: (can) => can("project.view") },
      { to: "/projects/budget", label: "Project Budget", show: (can) => can("project.view") },
    ],
  },
  {
    section: "Expenses",
    items: [
      { to: "/projects/expenses", label: "Project Expenses", show: (can) => can("project.view") },
      { to: "/expenses/approvals", label: "Expense Approvals", show: canApproveAnyExpense },
    ],
  },
  {
    section: "Approvals",
    items: [{ to: "/approvals", label: "My Approvals", show: canApproveAnything }],
  },
  {
    section: "Reports",
    items: [
      { to: "/reports/team", label: "Team Reports", show: (can) => can("leave.approve_as_manager") },
      { to: "/reports/projects", label: "Project Reports", show: (can) => can("project.view") },
      { to: "/reports/expenses", label: "Expense Reports", show: (can) => can("expense.approve_as_manager") },
    ],
  },
  {
    section: "HR",
    items: [
      { to: "/", label: "People", show: (can) => can("people.view") },
      { to: "/job-titles", label: "Job Titles", show: (can) => can("people.manage") },
      { to: "/leave-types", label: "Leave Types", show: (can) => can("leave.configure_policy") },
      { to: "/reimbursement", label: "Reimbursement", show: (can) => can("expense.view") },
      { to: "/accounting", label: "Accounting", show: (can) => can("accounting.view") },
      { to: "/onboarding", label: "Onboarding", show: (can) => can("onboarding.view") },
      { to: "/documents", label: "Documents", show: (can) => can("employee_docs.view") },
      { to: "/fnf", label: "Full & Final Settlement", show: (can) => can("fnf.view") },
      { to: "/announcements", label: "Announcements & Policies", show: () => true },
      { to: "/audit-log", label: "Audit Log", show: (can) => can("admin.view_audit_log") },
    ],
  },
];

export default function AppShell() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const spotRef = useRef<HTMLDivElement>(null);
  const [spotVisible, setSpotVisible] = useState(false);

  // Dark-mode-only cursor spotlight: a radial glow that tracks the pointer across the
  // whole screen — sidebar and main content alike, not just one panel. Position is written
  // straight to the DOM node on every move (no re-render); visibility is the only thing
  // driven by React state, since it changes rarely. Coordinates are viewport-relative since
  // the overlay itself is fixed to the viewport, spanning everything.
  const handleShellMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (spotRef.current) {
      spotRef.current.style.background = `radial-gradient(280px circle at ${e.clientX}px ${e.clientY}px, rgba(124,92,255,.16), transparent 70%)`;
    }
  };

  // A SuperAdmin has no client-side permissions at all — if one lands on any client route
  // directly (typed URL, stale bookmark), send them back to their own platform dashboard
  // instead of rendering this shell empty around them.
  if (can("platform.manage_tenants")) return <Navigate to="/admin/dashboard" replace />;

  const groups = user?.role === "Manager" ? MANAGER_NAV_GROUPS
    : user?.role === "Employee" ? EMPLOYEE_NAV_GROUPS
    : user?.role === "Finance" ? FINANCE_NAV_GROUPS
    : DEFAULT_NAV_GROUPS;
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.show(can)) }))
    .filter((group) => group.items.length > 0);

  return (
    <div
      style={styles.shell}
      onMouseMove={handleShellMouseMove}
      onMouseEnter={() => setSpotVisible(true)}
      onMouseLeave={() => setSpotVisible(false)}
    >
      <div ref={spotRef} className="app-spotlight" style={{ opacity: spotVisible ? 1 : 0 }} />
      <CommandPalette />
      <aside style={styles.sidebar}>
        <div style={styles.sidebarContent}>
        <div style={styles.brand}>
          <span style={styles.mark}>N</span>
          <span style={styles.brandName}>NEXORA</span>
        </div>
        <nav style={styles.nav}>
          {visibleGroups.map((group, groupIndex) => (
            <div key={`${group.section || "_root"}-${groupIndex}`} style={styles.navGroup}>
              {group.section && <div style={styles.navGroupLabel}>{group.section}</div>}
              {group.items.map((item) => (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  end={item.to === "/"}
                  className="sidebar-nav-link"
                  style={({ isActive }) => ({
                    ...styles.navLink,
                    ...(isActive ? styles.navLinkActive : {}),
                  })}
                >
                  <span style={styles.navLinkInner}>
                    {iconForLabel(item.label, 18)}
                    {item.label}
                  </span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        </div>
      </aside>

      <div style={styles.contentColumn}>
        <header style={styles.topbar}>
          <div style={styles.topbarRight}>
            <button style={styles.searchHint} onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}>
              Search <kbd style={styles.searchKbd}>Ctrl K</kbd>
            </button>
            <NotificationsBell />
            <span style={styles.userName}>{user?.displayName}</span>
            <ThemeToggle compact />
            <button style={styles.logout} onClick={logout}>Sign out</button>
          </div>
        </header>
        <main style={styles.main}>
          <div key={location.pathname} className="page-transition">
            <AnnouncementBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: "grid", gridTemplateColumns: "272px 1fr", height: "100vh", position: "relative", overflow: "hidden" },
  sidebar: {
    background: "var(--surface-sunken)", borderRight: "1px solid var(--border)",
    position: "relative", overflow: "hidden", display: "flex", height: "100vh",
  },
  sidebarContent: {
    position: "relative", zIndex: 1, padding: "28px 18px", display: "flex",
    flexDirection: "column", overflowY: "auto", width: "100%", height: "100%",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 6px" },
  mark: {
    width: 28, height: 28, borderRadius: 8, background: "var(--accent)", color: "var(--accent-ink)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
    boxShadow: "var(--glow-accent)",
  },
  brandName: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)", letterSpacing: "-.01em" },
  nav: { display: "flex", flexDirection: "column", gap: 18, flex: 1 },
  navGroup: { display: "flex", flexDirection: "column", gap: 2 },
  navGroupLabel: {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase",
    color: "var(--faint)", padding: "0 14px", marginBottom: 4,
  },
  navLink: {
    padding: "10px 14px", borderRadius: "var(--radius)", color: "var(--muted)",
    textDecoration: "none", fontSize: 15, fontWeight: 600,
    borderLeft: "3px solid transparent", marginLeft: -3,
    display: "block",
  },
  navLinkInner: { display: "flex", alignItems: "center", gap: 10 },
  navLinkActive: {
    background: "var(--accent-soft)", color: "var(--accent)",
    borderLeft: "3px solid var(--accent)",
  },
  contentColumn: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  topbar: {
    height: 64, display: "flex", alignItems: "center", justifyContent: "flex-end",
    padding: "0 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
    flexShrink: 0,
  },
  topbarRight: { display: "flex", alignItems: "center", gap: 14 },
  searchHint: {
    display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)",
    border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--muted)",
    fontSize: 13, fontWeight: 500, padding: "7px 12px", cursor: "pointer",
  },
  searchKbd: {
    fontFamily: "var(--font-mono)", fontSize: 10.5, background: "var(--surface)",
    border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 5px",
  },
  userName: { fontSize: 13, fontWeight: 600, color: "var(--ink)" },
  logout: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer",
  },
  main: { padding: "32px 40px", background: "var(--bg)", flex: 1, overflowY: "auto" },
};

import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import AnnouncementBanner from "./AnnouncementBanner";
import NotificationsBell from "./NotificationsBell";
import CommandPalette from "./CommandPalette";
import { iconForLabel } from "./icons";

type Can = (permission: string) => boolean;
type NavItem = { to: string; label: string; show: (can: Can) => boolean };
type NavSection = { section: string; items: NavItem[] };

// A module is either a direct link (`to` set — Dashboard, Approvals, Accounting's own hub
// page) or an expandable group of sections (People, Projects, ...): clicking it toggles an
// accordion revealing what's actually inside, instead of the old flat list that showed every
// section for every module all at once regardless of where the user actually was.
type NavModule = {
  key: string;
  label: string;
  to?: string;
  // Only for an expandable module: clicking the header both opens its accordion AND
  // navigates to a command-center landing page for the module, instead of just toggling.
  landingTo?: string;
  sections: NavSection[];
  show?: (can: Can) => boolean;
};

const canApproveAnyExpense = (can: Can) =>
  can("expense.approve_as_manager") || can("expense.approve_as_finance") ||
  can("project.approve_expense_as_pm") || can("project.approve_expense_as_finance");
const canApproveAnything = (can: Can) =>
  can("leave.approve_as_manager") || can("leave.approve_as_hr") || canApproveAnyExpense(can);

// The Manager role gets its own fixed nav — a manager's job here is running their team and
// projects, not the HR/tenant-admin surface, so this list is deliberately closed rather than
// permission-filtered from the shared set below.
const MANAGER_MODULES: NavModule[] = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard", sections: [] },
  {
    key: "team", label: "Team",
    sections: [{
      section: "", items: [
        { to: "/my-team", label: "My Team", show: () => true },
        { to: "/attendance", label: "Attendance", show: () => true },
        { to: "/timecard", label: "Leave Approval", show: () => true },
        { to: "/timesheets/approval", label: "Timesheet Approval", show: () => true },
      ],
    }],
  },
  {
    key: "projects", label: "Projects",
    sections: [{
      section: "Projects", items: [
        // Create, staffing, and tasks all live on the one Projects workspace now (a project
        // card grid → pick one → team + tasks + budget together) instead of three separate pages.
        { to: "/projects/team", label: "Projects", show: () => true },
        { to: "/projects/progress", label: "Progress", show: () => true },
        { to: "/projects/profitability", label: "Profitability", show: () => true },
      ],
    }],
  },
  {
    key: "expenses", label: "Expenses",
    sections: [{
      section: "Expenses", items: [
        { to: "/expenses/team", label: "Team Expenses", show: () => true },
        { to: "/projects/expenses", label: "Project Expenses", show: () => true },
        { to: "/expenses/approvals", label: "Approvals", show: () => true },
      ],
    }],
  },
  {
    key: "my-work", label: "My Work",
    sections: [{
      section: "", items: [
        { to: "/my-profile", label: "My Profile", show: () => true },
        { to: "/my-time", label: "My Time", show: () => true },
        { to: "/timecard", label: "My Leave", show: () => true },
        { to: "/projects/mine", label: "My Projects", show: () => true },
        { to: "/my-expenses", label: "My Expenses", show: () => true },
        { to: "/my-payslips", label: "My Payslips", show: () => true },
      ],
    }],
  },
  {
    key: "reports", label: "Reports",
    sections: [{
      section: "Reports", items: [
        { to: "/reports/team", label: "Team Reports", show: () => true },
        { to: "/reports/projects", label: "Project Reports", show: () => true },
        { to: "/reports/expenses", label: "Expense Reports", show: () => true },
      ],
    }],
  },
];

// The Finance role gets its own fixed nav too — expense verification, the accounting
// core (Chart of Accounts/Journal Entries/Ledger/Trial Balance/Bank/Cash), project cost
// views, and financial reports. No AP/AR vendor-bill workflows or tax reports yet —
// those need business rules (payment terms, tax codes) that haven't been defined.
const FINANCE_MODULES: NavModule[] = [
  { key: "dashboard", label: "Dashboard", to: "/finance/dashboard", sections: [] },
  {
    key: "expenses", label: "Expenses",
    sections: [{
      section: "", items: [
        { to: "/reimbursement", label: "Employee Reimbursements", show: () => true },
        { to: "/projects/expenses", label: "Project Expenses", show: () => true },
        { to: "/expenses/approvals", label: "Expense Verification", show: () => true },
      ],
    }],
  },
  // One workspace: pick a project from the list, see budget, cost, and profitability
  // together — instead of four separate pages each re-selecting the same project.
  { key: "projects", label: "Projects", to: "/finance/projects", sections: [] },
  { key: "payroll", label: "Payroll Approvals", to: "/payroll/runs", sections: [] },
  // Finance holds accounting.post_entries but previously had no way to reach Chart of
  // Accounts/Journal Entries at all — only the read-only P&L/Balance Sheet/Cash Flow reports
  // further down were linked. Without this, Finance could never set up a cash/bank account
  // or post a manual journal entry through their own sidebar.
  { key: "accounting", label: "Accounting", to: "/accounting", sections: [] },
  {
    key: "reports", label: "Reports",
    sections: [{
      section: "", items: [
        { to: "/accounting/profit-and-loss", label: "P&L", show: () => true },
        { to: "/accounting/balance-sheet", label: "Balance Sheet", show: () => true },
        { to: "/accounting/cash-flow", label: "Cash Flow", show: () => true },
        { to: "/reports/expenses-all", label: "Expense Reports", show: () => true },
      ],
    }],
  },
];

// The Employee role gets its own fixed, self-service-only nav — same idea as Manager's:
// closed rather than permission-filtered from the shared set. Flat on purpose: five direct
// links is exactly as deep as a self-service menu should ever need to go.
const EMPLOYEE_MODULES: NavModule[] = [
  { key: "my-profile", label: "My Profile", to: "/my-profile", sections: [] },
  { key: "my-time", label: "My Time", to: "/attendance", sections: [] },
  { key: "my-leave", label: "My Leave", to: "/timecard", sections: [] },
  { key: "my-projects", label: "My Projects", to: "/projects/mine", sections: [] },
  { key: "my-expenses", label: "My Expenses", to: "/my-expenses", sections: [] },
  { key: "my-payslips", label: "My Payslips", to: "/my-payslips", sections: [] },
];

// perm: null means "every authenticated tenant user sees this" — no permission gate.
// Grouped into modules (People / Projects / Expenses / Accounting / Reports / Administration)
// so clicking one module exposes everything inside it, instead of every section for every
// module being listed all at once regardless of what the user is actually working on.
const DEFAULT_MODULES: NavModule[] = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard", sections: [] },
  {
    key: "approvals", label: "Approvals", to: "/approvals", sections: [],
    show: canApproveAnything,
  },
  {
    key: "people", label: "People", landingTo: "/people",
    sections: [
      {
        section: "Employees", items: [
          { to: "/", label: "Employee Directory", show: (can) => can("people.view") },
          { to: "/job-titles", label: "Job Titles", show: (can) => can("people.manage") },
        ],
      },
      {
        section: "Time & Attendance", items: [
          { to: "/attendance", label: "Attendance", show: (can) => can("attendance.clock_in_out") },
        ],
      },
      {
        section: "Leave", items: [
          { to: "/timecard", label: "Leave", show: (can) => can("timesheet.view") },
          { to: "/leave-types", label: "Leave Types", show: (can) => can("leave.configure_policy") },
        ],
      },
      {
        section: "Lifecycle", items: [
          { to: "/onboarding", label: "Onboarding", show: (can) => can("onboarding.view") },
          { to: "/documents", label: "Documents", show: (can) => can("employee_docs.view") },
          { to: "/fnf", label: "Full & Final Settlement", show: (can) => can("fnf.view") },
        ],
      },
      {
        section: "Payroll", items: [
          { to: "/payroll/runs", label: "Payroll Runs", show: (can) => can("payroll.manage") || can("payroll.approve") },
        ],
      },
      {
        section: "Policies", items: [
          { to: "/announcements", label: "Announcements & Policies", show: () => true },
        ],
      },
    ],
  },
  {
    key: "projects", label: "Projects", landingTo: "/projects-overview",
    sections: [{
      section: "", items: [
        { to: "/projects", label: "All Projects", show: (can) => can("project.view") },
        { to: "/projects/create", label: "Create Project", show: (can) => can("project.manage_budget") },
        { to: "/projects/planning", label: "Project Planning", show: (can) => can("project.manage_budget") },
        { to: "/projects/team", label: "Project Team", show: (can) => can("project.view") },
        { to: "/projects/tasks", label: "Project Tasks", show: (can) => can("project.view") },
        { to: "/projects/progress", label: "Project Progress", show: (can) => can("project.view") },
        { to: "/projects/budget", label: "Project Budget", show: (can) => can("project.view") },
      ],
    }],
  },
  {
    key: "expenses", label: "Expenses", landingTo: "/expenses",
    sections: [{
      section: "", items: [
        { to: "/projects/expenses", label: "Project Expenses", show: (can) => can("project.view") },
        { to: "/expenses/approvals", label: "Expense Approvals", show: canApproveAnyExpense },
        { to: "/reimbursement", label: "Reimbursement", show: (can) => can("expense.view") },
      ],
    }],
  },
  { key: "accounting", label: "Accounting", to: "/accounting", sections: [], show: (can) => can("accounting.view") },
  {
    key: "reports", label: "Reports", landingTo: "/reports",
    sections: [{
      section: "", items: [
        { to: "/reports/team", label: "Team Reports", show: (can) => can("leave.approve_as_manager") },
        { to: "/reports/projects", label: "Project Reports", show: (can) => can("project.view") },
        { to: "/reports/expenses", label: "Expense Reports", show: (can) => can("expense.approve_as_manager") },
      ],
    }],
  },
  {
    key: "administration", label: "Administration",
    sections: [{
      section: "", items: [
        { to: "/roles", label: "Roles & Permissions", show: (can) => can("admin.manage_roles") },
        { to: "/audit-log", label: "Audit Log", show: (can) => can("admin.view_audit_log") },
      ],
    }],
  },
];

function pathMatches(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(to + "/"));
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

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
      spotRef.current.style.background = `radial-gradient(140px circle at ${e.clientX}px ${e.clientY}px, rgba(124,92,255,.16), transparent 70%)`;
    }
  };

  const modules = user?.role === "Manager" ? MANAGER_MODULES
    : user?.role === "Employee" ? EMPLOYEE_MODULES
    : user?.role === "Finance" ? FINANCE_MODULES
    : DEFAULT_MODULES;

  const visibleModules = modules
    .map((m) => ({
      ...m,
      sections: m.sections
        .map((s) => ({ ...s, items: s.items.filter((i) => i.show(can)) }))
        .filter((s) => s.items.length > 0),
    }))
    .filter((m) => (m.to ? (m.show ? m.show(can) : true) : m.sections.length > 0));

  // Which module "owns" the current URL — drives both the header's active highlight and
  // which module auto-expands on navigation (e.g. following a link straight to /job-titles
  // opens the People module even though its own header link is "/").
  const activeModuleKey = visibleModules.find((m) =>
    (m.to && pathMatches(location.pathname, m.to)) ||
    (m.landingTo && pathMatches(location.pathname, m.landingTo)) ||
    m.sections.some((s) => s.items.some((i) => pathMatches(location.pathname, i.to)))
  )?.key ?? null;

  const activeItemLabel = visibleModules
    .flatMap((m) => m.sections.flatMap((s) => s.items))
    .find((i) => pathMatches(location.pathname, i.to))?.label;
  const activeModule = visibleModules.find((m) => m.key === activeModuleKey);

  const [openKey, setOpenKey] = useState<string | null>(activeModuleKey);
  useEffect(() => {
    if (activeModuleKey) setOpenKey(activeModuleKey);
  }, [activeModuleKey]);

  // A SuperAdmin has no client-side permissions at all — if one lands on any client route
  // directly (typed URL, stale bookmark), send them back to their own platform dashboard
  // instead of rendering this shell empty around them.
  if (can("platform.manage_tenants")) return <Navigate to="/admin/dashboard" replace />;

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
        {/* Fixed — never scrolls, regardless of how long the nav below gets. */}
        <div style={styles.brand}>
          <span style={styles.mark}>N</span>
          <span style={styles.brandName}>NEXORA</span>
        </div>

        {/* The only part of the sidebar that scrolls. Level-1 module headers; clicking an
            expandable one reveals its Level-2 sections right beneath it (accordion), instead
            of dumping every module's contents on screen at once. */}
        <nav style={styles.nav}>
          {visibleModules.map((m) => {
            const isOpen = !m.to && openKey === m.key;
            return (
              <div key={m.key}>
                {m.to ? (
                  <NavLink
                    to={m.to}
                    end={m.to === "/"}
                    className="sidebar-nav-link"
                    style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
                  >
                    <span style={styles.navLinkInner}>{iconForLabel(m.label, 18)}{m.label}</span>
                  </NavLink>
                ) : m.landingTo ? (
                  <NavLink
                    to={m.landingTo}
                    className="sidebar-nav-link"
                    style={{
                      ...styles.navLink, ...styles.navLinkButton,
                      ...(activeModuleKey === m.key ? styles.navLinkActive : {}),
                    }}
                    onClick={() => setOpenKey(m.key)}
                  >
                    <span style={styles.navLinkInner}>{iconForLabel(m.label, 18)}{m.label}</span>
                    <ChevronIcon open={isOpen} />
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    className="sidebar-nav-link"
                    style={{
                      ...styles.navLink, ...styles.navLinkButton,
                      ...(activeModuleKey === m.key ? styles.navLinkActive : {}),
                    }}
                    onClick={() => setOpenKey(isOpen ? null : m.key)}
                  >
                    <span style={styles.navLinkInner}>{iconForLabel(m.label, 18)}{m.label}</span>
                    <ChevronIcon open={isOpen} />
                  </button>
                )}

                {isOpen && (
                  <div style={styles.moduleSections}>
                    {m.sections.map((section, sectionIndex) => (
                      <div key={`${section.section || "_root"}-${sectionIndex}`} style={styles.navGroup}>
                        {section.section && <div style={styles.navGroupLabel}>{section.section}</div>}
                        {section.items.map((item) => (
                          <NavLink
                            key={`${item.to}-${item.label}`}
                            to={item.to}
                            end={item.to === "/"}
                            className="sidebar-nav-link"
                            style={({ isActive }) => ({
                              ...styles.navLink, ...styles.navLinkNested,
                              ...(isActive ? styles.navLinkActive : {}),
                            })}
                          >
                            <span style={styles.navLinkInner}>
                              {iconForLabel(item.label, 16)}
                              {item.label}
                            </span>
                          </NavLink>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Fixed — pinned to the bottom of the sidebar, outside the scrolling nav. */}
        <div style={styles.sidebarFooter}>
          <AnnouncementBanner />
        </div>
      </aside>

      <div style={styles.contentColumn}>
        <header style={styles.topbar}>
          <div style={styles.breadcrumb}>
            {activeModule && <span>{activeModule.label}</span>}
            {activeModule && activeItemLabel && activeItemLabel !== activeModule.label && (
              <>
                <span style={styles.breadcrumbSep}>/</span>
                <span style={styles.breadcrumbCurrent}>{activeItemLabel}</span>
              </>
            )}
          </div>
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
    position: "relative", zIndex: 1, display: "flex", flexDirection: "column",
    height: "100vh", padding: "28px 18px",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 6px", flexShrink: 0 },
  mark: {
    width: 28, height: 28, borderRadius: 8, background: "var(--accent)", color: "var(--accent-ink)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
    boxShadow: "var(--glow-accent)",
  },
  brandName: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)", letterSpacing: "-.01em" },
  // The only scrolling piece of the sidebar — brand above and footer below stay put
  // regardless of how many modules a role's menu has, or how many are expanded.
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0, overflowY: "auto" },
  moduleSections: { display: "flex", flexDirection: "column", gap: 12, padding: "6px 0 10px" },
  sidebarFooter: { flexShrink: 0 },
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
  navLinkButton: {
    // Reset only the non-left sides explicitly — mixing the `border` shorthand with the
    // `borderLeft` longhand that navLink/navLinkActive set causes React to warn on re-render
    // (toggling active state) about conflicting shorthand/non-shorthand style properties.
    width: "100%", background: "none", borderTop: "none", borderRight: "none", borderBottom: "none",
    cursor: "pointer", font: "inherit",
    textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  navLinkNested: { fontSize: 14, padding: "8px 14px 8px 28px" },
  navLinkInner: { display: "flex", alignItems: "center", gap: 10 },
  navLinkActive: {
    background: "var(--accent-soft)", color: "var(--accent)",
    borderLeft: "3px solid var(--accent)",
  },
  contentColumn: { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" },
  topbar: {
    height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
    flexShrink: 0,
  },
  breadcrumb: {
    display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: "var(--muted)",
  },
  breadcrumbSep: { color: "var(--faint)" },
  breadcrumbCurrent: { color: "var(--ink)" },
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

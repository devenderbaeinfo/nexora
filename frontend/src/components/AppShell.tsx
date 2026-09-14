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

// One flat, unified nav tree for every tenant role — a monolithic app gets one coherent
// IA, not four hand-curated trees per role. Every route that used to live in one of the
// four role-specific trees below is still here; what changed is that visibility is now
// entirely down to `show(can)` (permission-gated), the same way each item already worked
// within its own tree — nothing here is a new client-side security boundary, the backend
// still enforces every permission regardless (see Security doc §6).
const NAV_MODULES: NavModule[] = [
  { key: "overview", label: "Overview", to: "/dashboard", sections: [] },
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
        ],
      },
      {
        section: "Attendance", items: [
          { to: "/attendance", label: "Attendance", show: (can) => can("attendance.clock_in_out") },
          { to: "/my-time", label: "My Time", show: () => true },
        ],
      },
      {
        section: "Leave", items: [
          { to: "/timecard", label: "Leave", show: (can) => can("timesheet.view") },
          { to: "/timesheets/approval", label: "Timesheet Approval", show: canApproveAnything },
        ],
      },
      {
        section: "Team", items: [
          { to: "/my-team", label: "My Team", show: canApproveAnything },
        ],
      },
      {
        section: "Lifecycle", items: [
          { to: "/onboarding", label: "Onboarding", show: (can) => can("onboarding.view") },
          { to: "/documents", label: "Documents", show: (can) => can("employee_docs.view") },
        ],
      },
      {
        section: "My Work", items: [
          { to: "/my-profile", label: "My Profile", show: () => true },
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
    key: "finance", label: "Finance", landingTo: "/expenses",
    sections: [
      {
        section: "Expenses", items: [
          { to: "/expenses/approvals", label: "Expense Approvals", show: canApproveAnyExpense },
          { to: "/expenses/team", label: "Team Expenses", show: canApproveAnything },
          { to: "/my-expenses", label: "My Expenses", show: () => true },
        ],
      },
      {
        section: "Reimbursements", items: [
          { to: "/reimbursement", label: "Reimbursement", show: (can) => can("expense.view") },
        ],
      },
      {
        section: "Accounting", items: [
          // Chart of Accounts/Journal Entries/Ledger/Trial Balance/Bank & Cash/Vendor Bills
          // are all reached from this hub page, not separate nav entries.
          { to: "/accounting", label: "Accounting", show: (can) => can("accounting.view") },
        ],
      },
      {
        section: "Overview", items: [
          { to: "/finance/dashboard", label: "Finance Dashboard", show: (can) => can("accounting.view") },
          // One workspace: pick a project from the list, see budget, cost, and
          // profitability together, instead of re-selecting the same project per page.
          { to: "/finance/projects", label: "Project Finance", show: (can) => can("accounting.view") },
        ],
      },
    ],
  },
  {
    key: "work", label: "Work", landingTo: "/projects-overview",
    sections: [
      {
        section: "Projects", items: [
          { to: "/projects", label: "All Projects", show: (can) => can("project.view") },
          { to: "/projects/create", label: "Create Project", show: (can) => can("project.manage_budget") },
          { to: "/projects/planning", label: "Project Planning", show: (can) => can("project.manage_budget") },
          { to: "/projects/team", label: "Project Team", show: (can) => can("project.view") },
          { to: "/projects/tasks", label: "Project Tasks", show: (can) => can("project.view") },
          { to: "/projects/progress", label: "Project Progress", show: (can) => can("project.view") },
          { to: "/projects/budget", label: "Project Budget", show: (can) => can("project.view") },
          { to: "/projects/profitability", label: "Profitability", show: (can) => can("project.view") },
          { to: "/projects/expenses", label: "Project Expenses", show: (can) => can("project.view") },
          { to: "/projects/mine", label: "My Projects", show: () => true },
        ],
      },
      {
        section: "Time Cards", items: [
          { to: "/timecard", label: "Time Cards", show: (can) => can("timesheet.view") },
        ],
      },
    ],
  },
  {
    key: "payroll", label: "Payroll", landingTo: "/payroll/runs",
    sections: [{
      section: "", items: [
        { to: "/payroll/runs", label: "Payroll Runs", show: (can) => can("payroll.manage") || can("payroll.approve") },
        { to: "/my-payslips", label: "My Payslips", show: () => true },
        { to: "/fnf", label: "Full & Final Settlement", show: (can) => can("fnf.view") },
      ],
    }],
  },
  {
    key: "reports", label: "Reports", landingTo: "/reports",
    sections: [{
      section: "", items: [
        { to: "/reports/team", label: "Team Reports", show: (can) => can("leave.approve_as_manager") },
        { to: "/reports/projects", label: "Project Reports", show: (can) => can("project.view") },
        { to: "/reports/expenses", label: "Expense Reports", show: (can) => can("expense.approve_as_manager") },
        { to: "/reports/expenses-all", label: "All Expense Reports", show: canApproveAnyExpense },
        { to: "/accounting/profit-and-loss", label: "P&L", show: (can) => can("accounting.view") },
        { to: "/accounting/balance-sheet", label: "Balance Sheet", show: (can) => can("accounting.view") },
        { to: "/accounting/cash-flow", label: "Cash Flow", show: (can) => can("accounting.view") },
      ],
    }],
  },
  {
    key: "settings", label: "Settings",
    sections: [{
      section: "", items: [
        { to: "/job-titles", label: "Job Titles", show: (can) => can("people.manage") },
        { to: "/leave-types", label: "Leave Types", show: (can) => can("leave.configure_policy") },
        { to: "/roles", label: "Roles & Permissions", show: (can) => can("admin.manage_roles") },
        { to: "/report-access", label: "Report Access", show: (can) => can("admin.manage_roles") },
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

// Points the same direction as travel: "«" collapse, "»" expand.
function RailToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transform: collapsed ? "rotate(180deg)" : "none" }}
    >
      <path d="M15 6l-6 6 6 6" /><path d="M9.5 6l-6 6 6 6" />
    </svg>
  );
}

// The active label stays neutral ink/slate (per spec: "text remains navy/slate") — only
// the icon itself picks up the identity teal, so the active row doesn't read as a solid
// colored pill.
function NavIcon({ label, size, active }: { label: string; size: number; active: boolean }) {
  return (
    <span style={{ display: "flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", color: active ? "var(--teal)" : "var(--muted)" }}>
      {iconForLabel(label, size)}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const SIDEBAR_STORAGE_KEY = "nexora-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // private browsing / storage blocked — fall through to the viewport-based default
  }
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1180px)").matches;
}

export default function AppShell() {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const spotRef = useRef<HTMLDivElement>(null);
  const [spotVisible, setSpotVisible] = useState(false);

  // Desktop/tablet: the sidebar collapses to a 72px icon rail. Below 760px it instead
  // becomes an off-canvas drawer (mobileOpen), since a rail is too small a target for touch.
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsedPersist = (next: boolean) => {
    setCollapsed(next);
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0"); } catch { /* per-viewer convenience only */ }
  };
  // Clicking a nav icon while the rail is collapsed expands it back to the full sidebar,
  // in addition to whatever that click already does (navigate / open its accordion).
  const expandIfCollapsed = () => { if (collapsed) setCollapsedPersist(false); };

  // The off-canvas drawer should never still be open after a navigation happens underneath it.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

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

  const visibleModules = NAV_MODULES
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

  const sidebarClassName = [
    "app-shell-sidebar",
    collapsed && "is-collapsed",
    mobileOpen && "is-mobile-open",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="app-canvas app-shell-grid"
      style={styles.shell}
      onMouseMove={handleShellMouseMove}
      onMouseEnter={() => setSpotVisible(true)}
      onMouseLeave={() => setSpotVisible(false)}
    >
      <div ref={spotRef} className="app-spotlight" style={{ opacity: spotVisible ? 1 : 0 }} />
      <CommandPalette />
      {mobileOpen && (
        <div className="app-shell-scrim is-visible" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={sidebarClassName} style={styles.sidebar}>
        {/* Fixed — never scrolls, regardless of how long the nav below gets. */}
        <div className="app-shell-brand-row" style={styles.brand}>
          <span style={styles.mark}>N</span>
          <span className="app-shell-hide-collapsed" style={styles.brandName}>NEXORA</span>
          <button
            type="button"
            className="app-shell-collapse-btn"
            style={styles.collapseButton}
            onClick={() => setCollapsedPersist(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <RailToggleIcon collapsed={collapsed} />
          </button>
        </div>

        {/* The only part of the sidebar that scrolls. Level-1 module headers; clicking an
            expandable one reveals its Level-2 sections right beneath it (accordion), instead
            of dumping every module's contents on screen at once. When the rail is collapsed,
            clicking any icon re-expands the sidebar in addition to its normal action. */}
        <nav style={styles.nav}>
          {visibleModules.map((m) => {
            const isOpen = !m.to && openKey === m.key && !collapsed;
            return (
              <div key={m.key}>
                {m.to ? (
                  <NavLink
                    to={m.to}
                    end={m.to === "/"}
                    className="sidebar-nav-link"
                    style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
                    onClick={expandIfCollapsed}
                    title={collapsed ? m.label : undefined}
                  >
                    {({ isActive }) => (
                      <span className="app-shell-navlink-inner" style={styles.navLinkInner}>
                        <NavIcon label={m.label} size={18} active={isActive} />
                        <span className="app-shell-hide-collapsed">{m.label}</span>
                      </span>
                    )}
                  </NavLink>
                ) : m.landingTo ? (
                  <NavLink
                    to={m.landingTo}
                    className="sidebar-nav-link"
                    style={{
                      ...styles.navLink, ...styles.navLinkButton,
                      ...(activeModuleKey === m.key ? styles.navLinkActive : {}),
                    }}
                    onClick={() => { setOpenKey(m.key); expandIfCollapsed(); }}
                    title={collapsed ? m.label : undefined}
                  >
                    <span className="app-shell-navlink-inner" style={styles.navLinkInner}>
                      <NavIcon label={m.label} size={18} active={activeModuleKey === m.key} />
                      <span className="app-shell-hide-collapsed">{m.label}</span>
                    </span>
                    <span className="app-shell-hide-collapsed"><ChevronIcon open={isOpen} /></span>
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    className="sidebar-nav-link"
                    style={{
                      ...styles.navLink, ...styles.navLinkButton,
                      ...(activeModuleKey === m.key ? styles.navLinkActive : {}),
                    }}
                    onClick={() => {
                      if (collapsed) { expandIfCollapsed(); setOpenKey(m.key); }
                      else setOpenKey(isOpen ? null : m.key);
                    }}
                    title={collapsed ? m.label : undefined}
                  >
                    <span className="app-shell-navlink-inner" style={styles.navLinkInner}>
                      <NavIcon label={m.label} size={18} active={activeModuleKey === m.key} />
                      <span className="app-shell-hide-collapsed">{m.label}</span>
                    </span>
                    <span className="app-shell-hide-collapsed"><ChevronIcon open={isOpen} /></span>
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
                            {({ isActive }) => (
                              <span style={styles.navLinkInner}>
                                <NavIcon label={item.label} size={16} active={isActive} />
                                {item.label}
                              </span>
                            )}
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

        {/* Fixed — pinned to the bottom of the sidebar, outside the scrolling nav. Hidden
            entirely in rail mode; a banner has no readable form at 72px wide. */}
        {!collapsed && (
          <div className="app-shell-hide-collapsed" style={styles.sidebarFooter}>
            <AnnouncementBanner />
          </div>
        )}
      </aside>

      <div style={styles.contentColumn}>
        <header style={styles.topbar}>
          <div style={styles.breadcrumb}>
            <button
              type="button"
              className="app-shell-menu-btn"
              style={styles.menuButton}
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>
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
  // Width itself is owned by the .app-shell-sidebar/.is-collapsed CSS classes (they need a
  // transition + a media-query override); this only sets the color/spacing that doesn't vary.
  shell: { display: "flex", width: "100vw", minHeight: "100vh", position: "relative", overflow: "hidden" },
  sidebar: {
    // Follows the theme — white in light, deep slate in dark (--sidebar-bg is distinct
    // from --surface only in dark mode, where cards sit one step lighter than the rail).
    background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)",
    position: "relative", zIndex: 1, display: "flex", flexDirection: "column",
    height: "100vh", padding: "28px 14px", overflow: "hidden",
    // Width/flex-basis are intentionally NOT set here — the .app-shell-sidebar CSS class
    // owns them (248px base, 72px when .is-collapsed, 272px on the mobile drawer). An inline
    // `flex`/`width` here would always beat that class regardless of which class is applied,
    // which is exactly what silently broke the collapse toggle before this fix.
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 6px", flexShrink: 0 },
  mark: {
    // A fixed navy chip regardless of theme (literal hex, not var(--accent-strong) — that
    // token deliberately brightens in dark mode for text contrast, which is the opposite of
    // what a stable brand mark wants).
    width: 28, height: 28, borderRadius: 8, background: "#0E2948", color: "#FFFFFF",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, flexShrink: 0,
  },
  brandName: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)", letterSpacing: "-.01em", flex: 1 },
  collapseButton: {
    // display is owned by the .app-shell-collapse-btn CSS class, not set here — see tokens.css.
    alignItems: "center", justifyContent: "center",
    width: 26, height: 26, borderRadius: "var(--radius)", flexShrink: 0,
    background: "none", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer",
  },
  // The only scrolling piece of the sidebar — brand above and footer below stay put
  // regardless of how many modules a role's menu has, or how many are expanded.
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" },
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
    display: "block", whiteSpace: "nowrap", overflow: "hidden",
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
  navLinkInner: { display: "flex", alignItems: "center", gap: 10, overflow: "hidden" },
  // Text stays neutral ink/slate — only the icon (via NavIcon) and the left rail pick up
  // the identity teal, so the active row reads as "marked", not as a solid colored pill.
  navLinkActive: {
    background: "var(--teal-soft)", color: "var(--ink)",
    borderLeft: "3px solid var(--teal)",
  },
  contentColumn: { display: "flex", flexDirection: "column", flex: "1 1 auto", minWidth: 0, height: "100vh", overflow: "hidden" },
  topbar: {
    height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
    flexShrink: 0, gap: 16,
  },
  menuButton: {
    // display is owned by the .app-shell-menu-btn CSS class, not set here — see tokens.css.
    alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: "var(--radius)", marginRight: 2,
    background: "none", border: "1px solid var(--border)", color: "var(--muted)", cursor: "pointer",
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
  main: { padding: "24px 32px", background: "var(--bg)", flex: 1, minWidth: 0, width: "100%", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box" },
};

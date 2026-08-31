import { NavLink } from "react-router-dom";

// Deliberately short and platform-scoped — this list must never grow to include client-side
// ERP concepts (HR, Timecard, Projects, ...). Those live in the Client Admin's own sidebar.
const NAV_GROUPS: { heading: string; items: { to: string; label: string }[] }[] = [
  {
    heading: "MAIN",
    items: [
      { to: "/admin/dashboard", label: "Dashboard" },
      { to: "/admin/analytics", label: "Analytics" },
    ],
  },
  {
    heading: "CLIENTS",
    items: [{ to: "/admin/clients", label: "Clients" }],
  },
  {
    heading: "PLATFORM",
    items: [{ to: "/admin/super-admins", label: "Super Admins" }],
  },
  {
    heading: "BILLING",
    items: [
      { to: "/admin/plans", label: "Plans" },
      { to: "/admin/subscriptions", label: "Subscriptions" },
      { to: "/admin/invoices", label: "Invoices" },
      { to: "/admin/payments", label: "Payments" },
    ],
  },
];

export default function AdminSidebar() {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <span style={styles.mark}>N</span>
        <div>
          <div style={styles.brandName}>NEXORA</div>
          <div style={styles.brandSub}>Platform Control</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} style={styles.group}>
            <div style={styles.groupHeading}>{group.heading}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    background: "var(--surface-sunken)", borderRight: "1px solid var(--border)",
    padding: "28px 18px", display: "flex", flexDirection: "column", width: 256, flexShrink: 0,
    height: "100vh", overflowY: "auto",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, marginBottom: 36, padding: "0 6px" },
  mark: {
    width: 28, height: 28, borderRadius: 8, background: "var(--accent)", color: "var(--accent-ink)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, flexShrink: 0,
  },
  brandName: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--ink)", lineHeight: 1.2 },
  brandSub: { fontSize: 10.5, color: "var(--faint)", fontWeight: 600, letterSpacing: ".04em" },
  nav: { display: "flex", flexDirection: "column", gap: 22 },
  group: { display: "flex", flexDirection: "column", gap: 2 },
  groupHeading: {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", fontWeight: 700,
    color: "var(--faint)", padding: "0 14px 6px",
  },
  navLink: {
    padding: "9px 14px", borderRadius: "var(--radius)", color: "var(--muted)",
    textDecoration: "none", fontSize: 14, fontWeight: 600,
    borderLeft: "3px solid transparent", marginLeft: -3,
  },
  navLinkActive: { background: "var(--accent-soft)", color: "var(--accent)", borderLeft: "3px solid var(--accent)" },
};

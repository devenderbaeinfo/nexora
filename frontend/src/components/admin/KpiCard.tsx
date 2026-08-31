import type { KpiStat } from "../../data/adminMockData";

const ICONS: Record<KpiStat["icon"], React.ReactNode> = {
  clients: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="8" width="7" height="12" rx="1.5" />
      <path d="M6.5 8h0M6.5 12h0M6.5 16h0M17.5 12h0M17.5 16h0" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
      <circle cx="17.5" cy="9" r="2.6" /><path d="M15 20c0-2.4 1.4-4 3.5-4.6" strokeLinecap="round" />
    </svg>
  ),
  revenue: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 17l5-5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function KpiCard({ stat }: { stat: KpiStat }) {
  const changeColor = stat.changeTone === "good" ? "var(--good)" : stat.changeTone === "warn" ? "var(--warn)" : "var(--accent)";
  const changeBg = stat.changeTone === "good" ? "var(--good-soft)" : stat.changeTone === "warn" ? "var(--warn-soft)" : "var(--accent-soft)";

  return (
    <div style={styles.card} className="card-surface">
      <div style={styles.head}>
        <span style={styles.label}>{stat.label}</span>
        <span style={styles.iconWrap}>{ICONS[stat.icon]}</span>
      </div>
      <div style={styles.value}>{stat.value}</div>
      <div style={styles.footer}>
        <span style={{ ...styles.change, background: changeBg, color: changeColor }}>{stat.change}</span>
        <span style={styles.supporting}>{stat.supportingText}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 20, boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 12,
  },
  head: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  label: { fontSize: 12.5, fontWeight: 600, color: "var(--muted)", lineHeight: 1.3 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 9, background: "var(--accent-soft)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  value: { fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--ink)" },
  footer: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  change: { fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20 },
  supporting: { fontSize: 12, color: "var(--faint)" },
};

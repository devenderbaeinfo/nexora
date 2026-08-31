import type { CSSProperties } from "react";

// Shared layout/table primitives for every Super Admin page — kept in one place so the
// seven pages read as one consistent product rather than seven independently-styled screens.
export const adminStyles: Record<string, CSSProperties> = {
  header: { marginBottom: 28 },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6, fontFamily: "var(--font-display)" },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 620 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 4, color: "var(--ink)" },
  sectionSubtitle: { fontSize: 13, color: "var(--faint)", marginBottom: 16 },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 24, boxShadow: "var(--shadow)",
  },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
    whiteSpace: "nowrap",
  },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  grid2: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 },
};

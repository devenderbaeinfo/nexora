import type { CSSProperties } from "react";

// Shared building blocks for the manager-facing pages (Dashboard, My Team, Project
// Planning/Team/Progress/Budget, Reports, Approvals) — lifted from the styling already
// established in Timecard.tsx/Onboarding.tsx so every new page matches without re-deriving it.
export const pageStyles: Record<string, CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 480 },
  select: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  input: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, boxShadow: "var(--shadow)",
  },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 },
  statCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, boxShadow: "var(--shadow)",
  },
  statLabel: { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 },
  statValue: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--accent)" },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
  },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  reject: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  secondary: {
    background: "var(--surface-sunken)", color: "var(--muted)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  progressTrack: {
    background: "var(--surface-sunken)", borderRadius: 20, height: 8, overflow: "hidden", marginTop: 6,
  },
  muted: { color: "var(--muted)" },
};

export function progressFill(percent: number, danger = false): CSSProperties {
  return {
    height: "100%", width: `${Math.min(100, Math.max(0, percent))}%`,
    background: danger ? "var(--danger)" : "var(--accent)", borderRadius: 20,
  };
}

export function tag(bg: string, fg: string): CSSProperties {
  return { fontFamily: "var(--font-mono)", fontSize: 11, background: bg, color: fg, padding: "3px 9px", borderRadius: 20 };
}

// Shared "pick a project" pattern: a grid of clickable cards (not a dropdown tucked in a
// corner) with the selected project's detail rendered below. First established in
// ProjectTeam.tsx, reused by Project Progress/Profitability so picking a project reads the
// same way everywhere in the Projects area.
export const projectCardGrid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14,
};

export const projectCard: CSSProperties = {
  textAlign: "left", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)", font: "inherit",
};

export const projectCardActive: CSSProperties = {
  borderColor: "var(--accent)", boxShadow: "var(--glow-accent), var(--shadow)",
};

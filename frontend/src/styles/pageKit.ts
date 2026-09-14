import type { CSSProperties } from "react";

// Shared building blocks for the manager-facing pages (Dashboard, My Team, Project
// Planning/Team/Progress/Budget, Reports, Approvals) — lifted from the styling already
// established in Timecard.tsx/Onboarding.tsx so every new page matches without re-deriving it.
export const pageStyles: Record<string, CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 6, fontFamily: "var(--font-display)", letterSpacing: "-.02em", color: "var(--ink)" },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 560, lineHeight: 1.5 },
  select: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    height: 40, padding: "0 12px", fontSize: 13, color: "var(--ink)",
  },
  input: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    height: 40, padding: "0 12px", fontSize: 13, color: "var(--ink)",
  },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, height: 40, padding: "0 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 20, boxShadow: "var(--shadow)",
  },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, width: "100%", minWidth: 0 },
  statCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 20, boxShadow: "var(--shadow)", minWidth: 0,
  },
  // One card can opt into this to read as the emphasized KPI in a row of otherwise-quiet
  // stat cards — a tinted accent surface instead of a fifth color, so it stays inside the
  // existing palette. Pair with `statTrend()` below for the small up/down indicator.
  statCardFeatured: {
    background: "var(--accent-soft)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)",
    padding: 20, boxShadow: "var(--shadow)",
  },
  statLabel: { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 },
  statValue: { fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--accent)" },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
    letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)",
    padding: "10px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
  },
  // ~13px vertical padding + line-height lands each row at 44-48px — dense enough to scan
  // a long list, generous enough that numbers/status chips don't feel cramped.
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, height: 32, padding: "0 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  reject: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, height: 32, padding: "0 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  secondary: {
    background: "var(--surface-sunken)", color: "var(--muted)", border: "none",
    fontSize: 12.5, fontWeight: 700, height: 32, padding: "0 12px", borderRadius: "var(--radius)", cursor: "pointer",
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
  return {
    display: "inline-flex", alignItems: "center", height: 26,
    fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600,
    background: bg, color: fg, padding: "0 10px", borderRadius: 20,
  };
}

// A small up/down indicator for a featured stat card — e.g. statTrend(4.2) or
// statTrend(-1.8, { invert: true }) when a lower number is the good direction.
export function statTrend(percent: number, opts?: { invert?: boolean }): CSSProperties {
  const isUp = percent >= 0;
  const isGood = opts?.invert ? !isUp : isUp;
  return {
    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700,
    color: isGood ? "var(--good)" : "var(--danger)", marginTop: 4,
  };
}

// Shared "pick a project" pattern: a grid of clickable cards (not a dropdown tucked in a
// corner) with the selected project's detail rendered below. First established in
// ProjectTeam.tsx, reused by Project Progress/Profitability so picking a project reads the
// same way everywhere in the Projects area.
export const projectCardGrid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16,
};

export const projectCard: CSSProperties = {
  textAlign: "left", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow)", font: "inherit",
};

export const projectCardActive: CSSProperties = {
  borderColor: "var(--accent)", boxShadow: "var(--glow-accent), var(--shadow)",
};

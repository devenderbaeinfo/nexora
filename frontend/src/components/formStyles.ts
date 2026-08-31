import type { CSSProperties } from "react";

export const formStyles: Record<string, CSSProperties> = {
  label: {
    fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em",
    textTransform: "uppercase", color: "var(--muted)", marginBottom: 6, display: "block",
  },
  field: {
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 14,
    color: "var(--ink)", marginBottom: 18, width: "100%",
  },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  button: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, padding: 12,
    borderRadius: "var(--radius)", cursor: "pointer", marginTop: 6,
  },
  buttonSecondary: {
    background: "none", border: "1px solid var(--border)", color: "var(--muted)",
    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14, padding: 12,
    borderRadius: "var(--radius)", cursor: "pointer", marginTop: 6,
  },
  error: {
    background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13,
    padding: "10px 12px", borderRadius: "var(--radius)", marginBottom: 16,
  },
  actions: { display: "flex", gap: 10, marginTop: 4 },
};

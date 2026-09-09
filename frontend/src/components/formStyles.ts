import type { CSSProperties } from "react";

export const formStyles: Record<string, CSSProperties> = {
  label: {
    fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em",
    textTransform: "uppercase", color: "var(--muted)", marginBottom: 6, display: "block",
  },
  field: {
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", height: 40, padding: "0 12px", fontSize: 14,
    color: "var(--ink)", marginBottom: 18, width: "100%",
  },
  // Opt-in — sits directly under a field that used `fieldTight` (no bottom margin of its
  // own) so the two read as one label/field/helper unit instead of floating independently.
  fieldTight: {
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", height: 40, padding: "0 12px", fontSize: 14,
    color: "var(--ink)", width: "100%",
  },
  helperText: { fontSize: 12, color: "var(--muted)", marginTop: 6, marginBottom: 18 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  button: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, height: 40,
    borderRadius: "var(--radius)", cursor: "pointer", marginTop: 6,
  },
  buttonSecondary: {
    background: "none", border: "1px solid var(--border)", color: "var(--muted)",
    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, height: 40,
    borderRadius: "var(--radius)", cursor: "pointer", marginTop: 6,
  },
  error: {
    background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13,
    padding: "10px 12px", borderRadius: "var(--radius)", marginBottom: 16,
  },
  actions: { display: "flex", gap: 10, marginTop: 4 },
};

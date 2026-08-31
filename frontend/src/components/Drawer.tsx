import type { ReactNode } from "react";

export default function Drawer({
  open, title, onClose, children,
}: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop" style={styles.backdrop} onClick={onClose}>
      <div className="drawer-panel" style={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(10,10,14,.45)",
    display: "flex", justifyContent: "flex-end", zIndex: 50,
  },
  panel: {
    width: "min(440px, 100%)", height: "100%", background: "var(--surface)",
    borderLeft: "1px solid var(--border)", padding: 32, overflowY: "auto",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 600 },
  close: {
    background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "var(--muted)",
    cursor: "pointer", padding: 4,
  },
  body: { display: "flex", flexDirection: "column" },
};

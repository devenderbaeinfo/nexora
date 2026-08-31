export default function BulkActionBar({
  count, onApprove, onReject, pending,
}: { count: number; onApprove: () => void; onReject: () => void; pending: boolean }) {
  if (count === 0) return null;

  return (
    <div style={styles.bar}>
      <span style={styles.count}>{count} selected</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.approve} disabled={pending} onClick={onApprove}>Approve selected</button>
        <button style={styles.reject} disabled={pending} onClick={onReject}>Reject selected</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    background: "var(--accent-soft)", border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 10,
  },
  count: { fontSize: 13, fontWeight: 700, color: "var(--accent)" },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  reject: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "7px 14px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

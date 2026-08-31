interface Segment { label: string; value: number; color: string; }

// A simple stacked horizontal bar + legend — reused for both User Growth and Client Growth
// so the two sections stay visually consistent without a charting dependency.
export default function BreakdownBar({ total, segments }: { total: number; segments: Segment[] }) {
  return (
    <div>
      <div style={styles.track}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%`, background: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div style={styles.legend}>
        {segments.map((s) => (
          <div key={s.label} style={styles.legendItem}>
            <span style={{ ...styles.dot, background: s.color }} />
            <span style={styles.legendLabel}>{s.label}</span>
            <span style={styles.legendValue}>{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    display: "flex", height: 10, borderRadius: 6, overflow: "hidden",
    background: "var(--surface-2)", marginBottom: 16,
  },
  legend: { display: "flex", flexDirection: "column", gap: 8 },
  legendItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  legendLabel: { color: "var(--muted)", flex: 1 },
  legendValue: { color: "var(--ink)", fontWeight: 700, fontFamily: "var(--font-mono)" },
};

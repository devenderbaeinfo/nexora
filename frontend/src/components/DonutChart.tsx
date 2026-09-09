export interface DonutSlice { label: string; value: number; color: string; }

// A minimal, dependency-free SVG donut — mirrors TrendChart's "no charting library" approach.
// Renders a center total plus a simple label/percent legend; no hover tooltip since the
// legend already shows every value at a glance.
export default function DonutChart({
  slices, centerLabel, formatValue,
}: { slices: DonutSlice[]; centerLabel?: string; formatValue?: (n: number) => string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString());
  const size = 160, stroke = 22, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices.map((s) => {
    const fraction = total === 0 ? 0 : s.value / total;
    const dash = fraction * circumference;
    const arc = { ...s, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
          {total > 0 && arcs.map((a) => (
            <circle
              key={a.label} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={stroke}
              strokeDasharray={`${a.dash} ${circumference - a.dash}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {centerLabel && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{fmt(total)}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{centerLabel}</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 160 }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink)", flex: 1 }}>{s.label}</span>
            <span style={{ color: "var(--muted)" }}>{total === 0 ? "0%" : `${Math.round((s.value / total) * 100)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

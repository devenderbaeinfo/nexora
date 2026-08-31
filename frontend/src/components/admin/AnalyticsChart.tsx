// A plain SVG area+line chart — no charting library needed for one series. Points are laid
// out proportionally to the data's own min/max, so new months in the config just work.
export default function AnalyticsChart({
  data, unit = "L", height = 220,
}: { data: { month: string; value: number }[]; unit?: string; height?: number }) {
  const width = 640;
  const paddingX = 28;
  const paddingY = 24;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(0, Math.min(...data.map((d) => d.value)));
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * innerW;
    const y = paddingY + innerH - ((d.value - min) / (max - min || 1)) * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + innerH} L ${points[0].x} ${paddingY + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Revenue over time">
      <defs>
        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6D4AFF" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6D4AFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={paddingX} x2={width - paddingX}
          y1={paddingY + innerH * f} y2={paddingY + innerH * f}
          stroke="var(--border)" strokeWidth="1"
        />
      ))}

      <path d={areaPath} fill="url(#revenueFill)" />
      <path d={linePath} fill="none" stroke="#6D4AFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x} cy={p.y} r={i === points.length - 1 ? 4.5 : 3}
            fill={i === points.length - 1 ? "#12D6C5" : "#6D4AFF"}
            stroke="var(--surface)" strokeWidth="1.5"
          />
          <text x={p.x} y={height - 4} textAnchor="middle" fontSize="10.5" fill="var(--faint)">
            {p.month}
          </text>
        </g>
      ))}

      <text
        x={points[points.length - 1].x} y={points[points.length - 1].y - 12}
        textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)"
      >
        ₹{points[points.length - 1].value}{unit}
      </text>
    </svg>
  );
}

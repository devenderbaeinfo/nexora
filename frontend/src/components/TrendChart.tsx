import { useMemo, useState } from "react";

export interface TrendSeries {
  name: string;
  color: string;
  values: number[];
}

interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
  height?: number;
  formatValue?: (n: number) => string;
  fillArea?: boolean;
}

// A minimal, dependency-free SVG line chart: one hue per series in fixed order (never
// cycled), a hover crosshair + tooltip (line charts get one by default), a legend when
// there's more than one series, and direct end-labels instead of a label on every point.
export default function TrendChart({ labels, series, height = 200, formatValue, fillArea }: TrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 640;
  const padding = { top: 16, right: 12, bottom: 26, left: 12 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const fmt = formatValue ?? ((n: number) => n.toLocaleString());

  const { min, max } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const lo = Math.min(0, ...all);
    const hi = Math.max(1, ...all);
    return { min: lo, max: hi };
  }, [series]);

  const n = labels.length;
  const xAt = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => plotH - ((v - min) / (max - min || 1)) * plotH;

  const pathFor = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");

  const areaFor = (values: number[]) =>
    `${pathFor(values)} L ${xAt(values.length - 1).toFixed(1)} ${plotH} L ${xAt(0).toFixed(1)} ${plotH} Z`;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width - padding.left;
    const idx = Math.round((relX / plotW) * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, idx)));
  };

  return (
    <div style={{ position: "relative" }}>
      {series.length > 1 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, display: "inline-block" }} />
              {s.name}
            </div>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border)" strokeWidth={1} />

          {fillArea && series[0] && (
            <path d={areaFor(series[0].values)} fill={series[0].color} fillOpacity={0.12} stroke="none" />
          )}

          {series.map((s) => (
            <path key={s.name} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {series.map((s) => (
            <circle
              key={`${s.name}-end`}
              cx={xAt(s.values.length - 1)}
              cy={yAt(s.values[s.values.length - 1])}
              r={3.5}
              fill={s.color}
            />
          ))}

          {hoverIndex !== null && (
            <>
              <line x1={xAt(hoverIndex)} y1={0} x2={xAt(hoverIndex)} y2={plotH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={`${s.name}-hover`} cx={xAt(hoverIndex)} cy={yAt(s.values[hoverIndex])} r={4} fill="var(--surface)" stroke={s.color} strokeWidth={2} />
              ))}
            </>
          )}

          {labels.map((label, i) => (
            (i === 0 || i === n - 1 || (n <= 8) || i % Math.ceil(n / 6) === 0) && (
              <text key={label + i} x={xAt(i)} y={plotH + 18} fontSize={10.5} fill="var(--faint)" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {label}
              </text>
            )
          ))}
        </g>
      </svg>

      {hoverIndex !== null && (
        <div style={tooltipStyle(hoverIndex, n)}>
          <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>{labels[hoverIndex]}</div>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
              <span style={{ color: "var(--muted)" }}>{s.name}:</span>
              <strong style={{ color: "var(--ink)" }}>{fmt(series.find((x) => x.name === s.name)!.values[hoverIndex])}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function tooltipStyle(hoverIndex: number, n: number): React.CSSProperties {
  const pct = n <= 1 ? 50 : (hoverIndex / (n - 1)) * 100;
  return {
    position: "absolute", top: 0,
    left: `${pct}%`, transform: `translateX(${pct > 70 ? "-100%" : pct < 15 ? "0%" : "-50%"})`,
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    boxShadow: "var(--shadow)", padding: "8px 12px", pointerEvents: "none", zIndex: 5, whiteSpace: "nowrap",
  };
}

import type { ReactNode } from "react";
import { pageStyles as s, statTrend, progressFill } from "../styles/pageKit";

// A flat white stat card for pages that don't use Dashboard's glass treatment (see
// dashboard.css — that atmosphere is deliberately scoped to the home page only). Number +
// trend badge + icon chip + a thin progress bar or sparkline underneath, all built on the
// same tokens/statTrend/progressFill every other page already uses.
export default function StatCard({
  icon, label, value, trendPercent, progressPercent, sparklineValues, color = "var(--accent)",
}: {
  icon?: ReactNode; label: string; value: string | number;
  trendPercent?: number; progressPercent?: number; sparklineValues?: number[]; color?: string;
}) {
  return (
    <div style={s.statCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        {icon && (
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
            borderRadius: "var(--radius)", background: "var(--surface-2)", color, flexShrink: 0,
          }}>
            {icon}
          </span>
        )}
        {typeof trendPercent === "number" && (
          <span style={statTrend(trendPercent)}>{trendPercent >= 0 ? "▲" : "▼"} {Math.abs(trendPercent)}%</span>
        )}
      </div>
      <div style={{ ...s.statValue, marginTop: 10 }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
      {typeof progressPercent === "number" && (
        <div style={s.progressTrack}>
          <div style={progressFill(progressPercent)} />
        </div>
      )}
      {sparklineValues && sparklineValues.length > 1 && (
        <Sparkline values={sparklineValues} color={color} />
      )}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 120, height = 28;
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, marginTop: 8, display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

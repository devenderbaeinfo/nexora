import { useId } from "react";

// Hand-authored abstract decorative art for the Dashboard page only — flowing ribbons, a
// glass orb, layered architectural arches, and a small connected-node cluster. Deliberately
// soft/low-contrast and non-literal: no leaves, no circuit boards, no 3D rendering. Every
// piece is pointer-events:none and purely decorative; removing this file changes nothing
// about how the dashboard functions.

function Ribbon({ gid, className, d, colorA, colorB }: { gid: string; className?: string; d: string; colorA: string; colorB: string }) {
  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="60%">
          <stop offset="0%" stopColor={colorA} />
          <stop offset="55%" stopColor={colorB} />
          <stop offset="100%" stopColor={colorB} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path className={className} d={d} fill={`url(#${gid})`} />
    </>
  );
}

function GlassOrb({ gid, cx, cy, r, edge }: { gid: string; cx: number; cy: number; r: number; edge: string }) {
  return (
    <>
      <defs>
        <radialGradient id={gid} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--orb-highlight)" />
          <stop offset="45%" stopColor="var(--orb-fill)" />
          <stop offset="100%" stopColor={edge} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} stroke="var(--orb-highlight)" strokeWidth={0.75} strokeOpacity={0.5} />
    </>
  );
}

// A few overlapping soft-topped arches — "layered glass panels" rather than a literal
// building; each one is just a rounded rectangle capped with a half-ellipse.
function ArchCluster({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const arch = (dx: number, w: number, h: number, opacity: number) => {
    const r = w / 2;
    return (
      <path
        key={dx}
        d={`M ${dx} ${h} L ${dx} ${r} A ${r} ${r} 0 0 1 ${dx + w} ${r} L ${dx + w} ${h} Z`}
        fill="var(--arch-fill)"
        stroke="var(--glass-border)"
        strokeWidth={1}
        opacity={opacity}
      />
    );
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {arch(0, 120, 150, 0.9)}
      {arch(46, 96, 130, 0.75)}
      {arch(84, 70, 100, 0.6)}
    </g>
  );
}

function NetworkCluster({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const nodes: [number, number][] = [[0, 40], [46, 0], [86, 34], [40, 78], [96, 84]];
  const edges: [number, number][] = [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4]];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {edges.map(([a, b], i) => {
        const [x1, y1] = nodes[a];
        const [x2, y2] = nodes[b];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 14;
        return <path key={i} d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} stroke="var(--network-line)" strokeWidth={1.25} fill="none" />;
      })}
      {nodes.map(([nx, ny], i) => (
        <circle key={i} cx={nx} cy={ny} r={i === 2 ? 4 : 2.6} fill="var(--node-color)" />
      ))}
    </g>
  );
}

// The full-page background layer. Sits behind .dashboard-content (z-index:0), pointer-events
// none, sized to the scrollable content column rather than the viewport. The CSS gradient
// blooms (top corners) live in dashboard.css; this SVG only adds the two bottom clusters the
// brief calls for plus a faint network motif drifting behind the KPI row.
export function DashboardAtmosphere() {
  const uid = useId();
  return (
    <div className="dashboard-atmosphere" aria-hidden="true">
      <svg width="620" height="420" style={{ left: -80, bottom: -100 }} className="drift drift-a">
        <Ribbon
          gid={`${uid}-ribbon1`}
          d="M -40,260 C 60,180 140,320 240,240 C 340,160 400,280 520,220 L 560,320 C 440,380 380,260 280,330 C 180,400 100,300 -20,360 Z"
          colorA="var(--ribbon-teal)" colorB="var(--ribbon-mint)"
        />
        <ArchCluster x={300} y={140} scale={1.1} />
      </svg>

      <svg width="520" height="380" style={{ right: -60, bottom: -80 }} className="drift drift-b">
        <GlassOrb gid={`${uid}-orb1`} cx={360} cy={120} r={70} edge="var(--orb-edge)" />
        <GlassOrb gid={`${uid}-orb2`} cx={250} cy={230} r={44} edge="var(--orb-edge)" />
        <Ribbon
          gid={`${uid}-ribbon2`}
          d="M 520,340 C 420,300 400,220 300,250 C 200,280 180,200 60,220 L 40,280 C 170,270 190,340 290,320 C 390,300 410,360 500,390 Z"
          colorA="var(--ribbon-lavender)" colorB="var(--ribbon-blue)"
        />
      </svg>

      <svg width="360" height="180" style={{ left: "38%", top: -20 }}>
        <NetworkCluster x={0} y={0} scale={1.4} />
      </svg>
    </div>
  );
}

// Compact ribbon + orb + node composition for a brand card. Two variants share the same
// primitives with a different color lean (teal/mint vs. lavender/blue) so the two cards
// read as a pair, not identical twins.
export function BrandVisual({ variant }: { variant: "a" | "b" }) {
  const uid = useId();
  const primary = variant === "a" ? "var(--ribbon-teal)" : "var(--ribbon-lavender)";
  const secondary = variant === "a" ? "var(--ribbon-mint)" : "var(--ribbon-blue)";

  return (
    <svg className="brand-visual" viewBox="0 0 420 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Ribbon
        gid={`${uid}-bv-ribbon`}
        d="M -20,150 C 60,90 120,190 200,140 C 280,90 320,180 460,130 L 460,190 C 340,220 300,150 210,190 C 120,230 60,170 -20,210 Z"
        colorA={primary} colorB={secondary}
      />
      <GlassOrb gid={`${uid}-bv-orb`} cx={variant === "a" ? 330 : 90} cy={60} r={variant === "a" ? 46 : 38} edge="var(--orb-edge)" />
      <NetworkCluster x={variant === "a" ? 20 : 260} y={10} scale={0.85} />
    </svg>
  );
}

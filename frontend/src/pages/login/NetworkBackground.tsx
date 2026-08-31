// A fixed set of nodes/edges (not randomized per render, so the layout doesn't jump on
// re-render) drawn as plain SVG — no canvas or animation library needed for something
// this subtle. A handful of nodes pulse gently via CSS; respects prefers-reduced-motion.
const NODES: { x: number; y: number; r: number; color: string; pulse?: boolean }[] = [
  { x: 60, y: 80, r: 2.2, color: "#7C5CFF", pulse: true },
  { x: 180, y: 40, r: 1.6, color: "#4F6FFF" },
  { x: 300, y: 120, r: 2, color: "#12D6C5", pulse: true },
  { x: 420, y: 60, r: 1.6, color: "#7C5CFF" },
  { x: 520, y: 160, r: 1.8, color: "#4F6FFF" },
  { x: 150, y: 220, r: 1.6, color: "#7C5CFF" },
  { x: 340, y: 260, r: 2.2, color: "#12D6C5", pulse: true },
  { x: 470, y: 320, r: 1.6, color: "#4F6FFF" },
  { x: 80, y: 340, r: 1.8, color: "#7C5CFF" },
  { x: 260, y: 400, r: 1.6, color: "#4F6FFF" },
  { x: 560, y: 420, r: 2, color: "#7C5CFF", pulse: true },
  { x: 20, y: 460, r: 1.6, color: "#12D6C5" },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [2, 6],
  [5, 8], [8, 9], [6, 9], [9, 10], [8, 11], [4, 10],
];

export default function NetworkBackground() {
  return (
    <svg
      className="bae-network-bg"
      viewBox="0 0 600 500"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
          stroke="#4F6FFF" strokeOpacity={0.18} strokeWidth={1}
        />
      ))}
      {NODES.map((n, i) => (
        <circle
          key={i}
          className={n.pulse ? "pulse" : undefined}
          cx={n.x} cy={n.y} r={n.r} fill={n.color} fillOpacity={0.8}
        />
      ))}
    </svg>
  );
}

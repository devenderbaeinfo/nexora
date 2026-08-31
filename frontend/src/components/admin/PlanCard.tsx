import type { Plan } from "../../data/adminMockData";
import StatusBadge from "./StatusBadge";

export default function PlanCard({ plan, featured }: { plan: Plan; featured?: boolean }) {
  return (
    <div
      className="card-surface"
      style={{
        background: "var(--surface)",
        border: featured ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        boxShadow: featured ? "0 0 0 4px var(--accent-soft)" : "var(--shadow)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--ink)" }}>{plan.name}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>{plan.price}</div>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Max users: <strong style={{ color: "var(--ink)" }}>{plan.maxUsers}</strong>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", letterSpacing: ".04em", marginBottom: 8 }}>MODULES INCLUDED</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {plan.modules.map((m) => (
            <span
              key={m}
              style={{
                fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)",
                padding: "4px 10px", borderRadius: 20,
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, fontSize: 13, color: "var(--muted)" }}>
        <strong style={{ color: "var(--ink)" }}>{plan.subscriberCount}</strong> {plan.subscriberCount === 1 ? "client" : "clients"} subscribed
      </div>
    </div>
  );
}

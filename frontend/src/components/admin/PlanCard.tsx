import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import StatusBadge from "./StatusBadge";

interface ModuleDto { key: string; label: string; }
interface PlanCardPlan {
  name: string; monthlyPrice: number | null; isCustomPricing: boolean;
  maxUsers: number | null; status: "Active" | "Deprecated"; moduleKeys: string[]; subscriberCount: number;
}

export default function PlanCard({
  plan, featured, onEdit, onDelete,
}: { plan: PlanCardPlan; featured?: boolean; onEdit: () => void; onDelete: () => void }) {
  const { data: modules } = useQuery({
    queryKey: ["platformModules"],
    queryFn: async () => (await api.get<ModuleDto[]>("/platform/modules")).data,
  });
  const labelFor = (key: string) => modules?.find((m) => m.key === key)?.label ?? key;

  const price = plan.isCustomPricing ? "Custom Pricing" : `₹${plan.monthlyPrice?.toLocaleString("en-IN")} / month`;
  const maxUsers = plan.maxUsers === null ? "Unlimited" : String(plan.maxUsers);

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
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>{price}</div>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Max users: <strong style={{ color: "var(--ink)" }}>{maxUsers}</strong>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", letterSpacing: ".04em", marginBottom: 8 }}>MODULES INCLUDED</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {plan.moduleKeys.length === 0 && <span style={{ fontSize: 12, color: "var(--faint)" }}>No modules yet</span>}
          {plan.moduleKeys.map((key) => (
            <span
              key={key}
              style={{
                fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)",
                padding: "4px 10px", borderRadius: 20,
              }}
            >
              {labelFor(key)}
            </span>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          <strong style={{ color: "var(--ink)" }}>{plan.subscriberCount}</strong> {plan.subscriberCount === 1 ? "client" : "clients"} subscribed
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onEdit} style={styles.linkButton}>Edit</button>
          <button type="button" onClick={onDelete} style={{ ...styles.linkButton, color: "var(--danger)" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  linkButton: {
    background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 700,
    cursor: "pointer", padding: 0,
  },
};

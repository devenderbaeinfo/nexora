import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import PlanCard from "../../components/admin/PlanCard";
import { adminStyles as s } from "../../components/admin/adminStyles";
import Drawer from "../../components/Drawer";
import Spinner from "../../components/Spinner";
import PlanForm, { type EditablePlan } from "./PlanForm";

interface PlanDto {
  id: string; name: string; monthlyPrice: number | null; isCustomPricing: boolean;
  maxUsers: number | null; status: "Active" | "Deprecated"; moduleKeys: string[]; subscriberCount: number;
}

function toEditable(p: PlanDto): EditablePlan {
  return { id: p.id, name: p.name, monthlyPrice: p.monthlyPrice, isCustomPricing: p.isCustomPricing, maxUsers: p.maxUsers, status: p.status, moduleKeys: p.moduleKeys };
}

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditablePlan | "new" | null>(null);

  const { data: plans, isLoading, error } = useQuery({
    queryKey: ["platformPlans"],
    queryFn: async () => (await api.get<PlanDto[]>("/platform/plans")).data,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platformPlans"] }),
  });

  return (
    <div>
      <header style={{ ...s.header, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={s.title}>Plans</h1>
          <p style={s.subtitle}>The subscription tiers clients choose from — pricing, user limits, and included modules.</p>
        </div>
        <button style={styles.addButton} onClick={() => setEditing("new")}>Add plan</button>
      </header>

      <Drawer open={editing !== null} title={editing === "new" ? "Add plan" : "Edit plan"} onClose={() => setEditing(null)}>
        {editing !== null && (
          <PlanForm plan={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
        )}
      </Drawer>

      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load plans. Try refreshing.</p>}

      {plans && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {plans.map((plan) => (
            <PlanCard
              plan={plan}
              featured={plan.name === "Professional"}
              key={plan.id}
              onEdit={() => setEditing(toEditable(plan))}
              onDelete={() => {
                if (confirm(`Delete the "${plan.name}" plan? Clients already on it keep their current modules until moved to a different plan.`)) {
                  remove.mutate(plan.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
};

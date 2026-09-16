import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formStyles as s } from "../../components/formStyles";
import ModulePicker from "../../components/admin/ModulePicker";

interface PlanOption { id: string; name: string; }
interface TenantDetail { id: string; planId: string | null; moduleKeys: string[]; }

const CUSTOM_PLAN = "custom";

export default function ChangePlanForm({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const queryClient = useQueryClient();

  const { data: detail } = useQuery({
    queryKey: ["platformTenantDetail", tenantId],
    queryFn: async () => (await api.get<TenantDetail>(`/platform/tenants/${tenantId}`)).data,
  });
  const { data: plans } = useQuery({
    queryKey: ["platformPlans"],
    queryFn: async () => (await api.get<PlanOption[]>("/platform/plans")).data,
  });

  const [planId, setPlanId] = useState<string | null>(null);
  const [moduleKeys, setModuleKeys] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed local state from the fetched detail exactly once it arrives, without stomping on
  // whatever the admin has already changed in the meantime.
  const effectivePlanId = planId ?? (detail ? detail.planId ?? CUSTOM_PLAN : CUSTOM_PLAN);
  const effectiveModuleKeys = moduleKeys ?? detail?.moduleKeys ?? [];

  const mutation = useMutation({
    mutationFn: () => api.patch(`/platform/tenants/${tenantId}/plan`, {
      planId: effectivePlanId === CUSTOM_PLAN ? null : effectivePlanId,
      moduleKeys: effectivePlanId === CUSTOM_PLAN ? effectiveModuleKeys : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platformTenants"] });
      onDone();
    },
    onError: () => setError("Couldn't update this client's plan. Try again."),
  });

  if (!detail) return <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</p>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate(); }}>
      <label style={s.label} htmlFor="changePlan">Plan</label>
      <select id="changePlan" style={s.field} value={effectivePlanId} onChange={(e) => setPlanId(e.target.value)}>
        <option value={CUSTOM_PLAN}>Custom — pick modules directly</option>
        {plans?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <label style={s.label}>Modules</label>
      <div style={{ marginBottom: 18 }}>
        {effectivePlanId === CUSTOM_PLAN ? (
          <ModulePicker selected={effectiveModuleKeys} onChange={setModuleKeys} />
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
            Fixed by the selected plan. Switch to Custom to pick modules directly.
          </p>
        )}
      </div>

      {error && <div style={s.error} role="alert">{error}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

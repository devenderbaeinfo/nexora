import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formStyles as s } from "../../components/formStyles";
import ModulePicker from "../../components/admin/ModulePicker";

export interface EditablePlan {
  id?: string;
  name: string;
  monthlyPrice: number | null;
  isCustomPricing: boolean;
  maxUsers: number | null;
  status: "Active" | "Deprecated";
  moduleKeys: string[];
}

const EMPTY_PLAN: EditablePlan = { name: "", monthlyPrice: null, isCustomPricing: false, maxUsers: null, status: "Active", moduleKeys: [] };

export default function PlanForm({ plan, onDone }: { plan?: EditablePlan; onDone: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!plan?.id;

  const [name, setName] = useState(plan?.name ?? EMPTY_PLAN.name);
  const [isCustomPricing, setIsCustomPricing] = useState(plan?.isCustomPricing ?? false);
  const [monthlyPrice, setMonthlyPrice] = useState(plan?.monthlyPrice?.toString() ?? "");
  const [maxUsers, setMaxUsers] = useState(plan?.maxUsers?.toString() ?? "");
  const [unlimitedUsers, setUnlimitedUsers] = useState(plan ? plan.maxUsers === null : false);
  const [status, setStatus] = useState<"Active" | "Deprecated">(plan?.status ?? "Active");
  const [moduleKeys, setModuleKeys] = useState<string[]>(plan?.moduleKeys ?? []);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name,
        monthlyPrice: isCustomPricing ? null : monthlyPrice === "" ? null : Number(monthlyPrice),
        isCustomPricing,
        maxUsers: unlimitedUsers ? null : maxUsers === "" ? null : Number(maxUsers),
        moduleKeys,
        status,
      };
      return isEdit ? api.put(`/platform/plans/${plan!.id}`, body) : api.post("/platform/plans", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platformPlans"] });
      onDone();
    },
    onError: () => setError("Couldn't save this plan. Check the fields and try again."),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit}>
      <label style={s.label} htmlFor="planName">Plan name</label>
      <input id="planName" style={s.field} value={name} onChange={(e) => setName(e.target.value)} required />

      <label style={{ ...s.label, display: "flex", alignItems: "center", gap: 8, textTransform: "none" }}>
        <input type="checkbox" checked={isCustomPricing} onChange={(e) => setIsCustomPricing(e.target.checked)} />
        Custom pricing (e.g. "Enterprise" — no fixed monthly price)
      </label>

      {!isCustomPricing && (
        <>
          <label style={s.label} htmlFor="monthlyPrice">Monthly price (₹)</label>
          <input id="monthlyPrice" type="number" min={0} style={s.field} value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} required />
        </>
      )}

      <label style={{ ...s.label, display: "flex", alignItems: "center", gap: 8, textTransform: "none", marginTop: isCustomPricing ? 0 : undefined }}>
        <input type="checkbox" checked={unlimitedUsers} onChange={(e) => setUnlimitedUsers(e.target.checked)} />
        Unlimited users
      </label>

      {!unlimitedUsers && (
        <>
          <label style={s.label} htmlFor="maxUsers">Max users</label>
          <input id="maxUsers" type="number" min={1} style={s.field} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} required />
        </>
      )}

      {isEdit && (
        <>
          <label style={s.label} htmlFor="status">Status</label>
          <select id="status" style={s.field} value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Deprecated")}>
            <option value="Active">Active</option>
            <option value="Deprecated">Deprecated</option>
          </select>
        </>
      )}

      <label style={s.label}>Modules included</label>
      <div style={{ marginBottom: 18 }}>
        <ModulePicker selected={moduleKeys} onChange={setModuleKeys} />
      </div>

      {error && <div style={s.error} role="alert">{error}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create plan"}
        </button>
      </div>
    </form>
  );
}

export { EMPTY_PLAN };

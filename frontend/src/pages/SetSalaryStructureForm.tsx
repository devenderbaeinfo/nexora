import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";
import Spinner from "../components/Spinner";

interface SalaryComponentDto {
  id: string; name: string; type: "Earning" | "Deduction";
  calculationType: "FixedAmount" | "PercentageOfBasic"; value: number; isBasic: boolean; sortOrder: number;
}
interface SalaryStructureDto { id: string; employeeId: string; effectiveFrom: string; isActive: boolean; components: SalaryComponentDto[]; }

interface Row { key: string; name: string; type: "Earning" | "Deduction"; calculationType: "FixedAmount" | "PercentageOfBasic"; value: number; isBasic: boolean; }

let nextKey = 0;
const newRow = (overrides: Partial<Row> = {}): Row => ({
  key: `new-${nextKey++}`, name: "", type: "Earning", calculationType: "FixedAmount", value: 0, isBasic: false, ...overrides,
});

// HR's salary-structure editor — a freeform list of earning/deduction components (unlike
// leave balances, there's no fixed catalog to map rows onto) with exactly one Earning
// flagged as Basic, since every PercentageOfBasic component calculates off it.
export default function SetSalaryStructureForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["payroll", "salary-structure", employeeId],
    queryFn: async () => (await api.get<SalaryStructureDto | null>(`/payroll/salary-structures/${employeeId}`)).data,
  });

  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setRows([newRow({ name: "Basic", isBasic: true }), newRow({ name: "House Rent Allowance" })]);
      return;
    }
    setEffectiveFrom(data.effectiveFrom);
    setRows(data.components.map((c) => ({ key: c.id, name: c.name, type: c.type, calculationType: c.calculationType, value: c.value, isBasic: c.isBasic })));
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put(`/payroll/salary-structures/${employeeId}`, {
      effectiveFrom,
      components: rows.map((r) => ({ name: r.name, type: r.type, calculationType: r.calculationType, value: r.value, isBasic: r.isBasic })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "salary-structure", employeeId] });
      onDone();
    },
    onError: (err: any) => setError(err?.response?.data ?? "Couldn't save this salary structure."),
  });

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return patch.isBasic ? { ...r, isBasic: false } : r;
      const next = { ...r, ...patch };
      if (patch.isBasic) { next.type = "Earning"; next.calculationType = "FixedAmount"; }
      return next;
    }));
  };

  const basicCount = rows.filter((r) => r.isBasic).length;
  const canSave = rows.length > 0 && rows.every((r) => r.name.trim()) && basicCount === 1;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <label style={s.label} htmlFor="effectiveFrom">Effective from</label>
      <input id="effectiveFrom" type="date" style={s.field} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {rows.map((r) => (
          <div key={r.key} style={rowStyle}>
            <input
              style={{ ...s.field, marginBottom: 0, flex: 2 }} placeholder="Component name"
              value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })}
            />
            <select
              style={{ ...s.field, marginBottom: 0, flex: 1 }} value={r.type} disabled={r.isBasic}
              onChange={(e) => updateRow(r.key, { type: e.target.value as Row["type"] })}
            >
              <option value="Earning">Earning</option>
              <option value="Deduction">Deduction</option>
            </select>
            <select
              style={{ ...s.field, marginBottom: 0, flex: 1 }} value={r.calculationType} disabled={r.isBasic}
              onChange={(e) => updateRow(r.key, { calculationType: e.target.value as Row["calculationType"] })}
            >
              <option value="FixedAmount">Fixed amount</option>
              <option value="PercentageOfBasic">% of Basic</option>
            </select>
            <input
              type="number" min={0} step={0.01} style={{ ...s.field, marginBottom: 0, width: 90 }}
              value={r.value} onChange={(e) => updateRow(r.key, { value: Number(e.target.value) })}
            />
            <label style={basicLabelStyle}>
              <input type="checkbox" checked={r.isBasic} onChange={(e) => updateRow(r.key, { isBasic: e.target.checked })} />
              Basic
            </label>
            <button type="button" style={removeButtonStyle} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}>×</button>
          </div>
        ))}
      </div>

      <button type="button" style={addButtonStyle} onClick={() => setRows((prev) => [...prev, newRow()])}>+ Add component</button>

      {basicCount !== 1 && (
        <p style={{ fontSize: 12.5, color: "var(--warn)", margin: "12px 0 0" }}>
          Exactly one Earning component must be marked Basic — every % of Basic component calculates off it.
        </p>
      )}
      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="button" style={s.button} disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save salary structure"}
        </button>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const basicLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" };
const removeButtonStyle: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: "var(--radius)",
  width: 28, height: 38, cursor: "pointer", fontSize: 16, lineHeight: 1,
};
const addButtonStyle: React.CSSProperties = {
  background: "var(--surface-sunken)", color: "var(--ink)", border: "1px solid var(--border)",
  fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--radius)", cursor: "pointer",
};

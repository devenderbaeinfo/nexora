import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";
import Spinner from "../components/Spinner";
import { formatCurrency } from "../lib/currency";

interface SalaryComponentDto {
  id: string; name: string; type: "Earning" | "Deduction";
  calculationType: "FixedAmount" | "PercentageOfBasic"; value: number; isBasic: boolean; sortOrder: number;
}
interface SalaryStructureDto { id: string; employeeId: string; effectiveFrom: string; isActive: boolean; components: SalaryComponentDto[]; }

interface Row { key: string; name: string; type: "Earning" | "Deduction"; calculationType: "FixedAmount" | "PercentageOfBasic"; value: number; isBasic: boolean; }

let nextKey = 0;
const newRow = (type: Row["type"], overrides: Partial<Row> = {}): Row => ({
  key: `new-${nextKey++}`, name: "", type, calculationType: "FixedAmount", value: 0, isBasic: false, ...overrides,
});

const currency = formatCurrency;

// HR's salary-structure editor — laid out as two columns (Additions / Deductions) matching
// how a payslip itself reads, so what HR builds here and what Finance later approves on the
// processed payslip (PayslipDetailView) look like the same document. Exactly one Addition is
// flagged Basic, since every % of Basic component (on either side) calculates off it.
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
      setRows([
        newRow("Earning", { name: "Basic", isBasic: true }),
        newRow("Earning", { name: "House Rent Allowance", calculationType: "PercentageOfBasic", value: 40 }),
        newRow("Deduction", { name: "Provident Fund", calculationType: "PercentageOfBasic", value: 12 }),
      ]);
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
      if (patch.isBasic) next.calculationType = "FixedAmount";
      return next;
    }));
  };
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const additions = rows.filter((r) => r.type === "Earning");
  const deductions = rows.filter((r) => r.type === "Deduction");
  const basicCount = additions.filter((r) => r.isBasic).length;
  const canSave = rows.length > 0 && rows.every((r) => r.name.trim()) && basicCount === 1;

  // Live preview — what HR builds here should already look like the number Finance will
  // later see on the processed payslip, so mismatches get caught before a run is ever created.
  const basicValue = additions.find((r) => r.isBasic)?.value ?? 0;
  const amountOf = (r: Row) => r.calculationType === "FixedAmount" ? r.value : (basicValue * r.value) / 100;
  const grossEarnings = additions.reduce((sum, r) => sum + amountOf(r), 0);
  const totalDeductions = deductions.reduce((sum, r) => sum + amountOf(r), 0);
  const netPay = grossEarnings - totalDeductions;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <label style={s.label} htmlFor="effectiveFrom">Effective from</label>
      <input id="effectiveFrom" type="date" style={{ ...s.field, maxWidth: 220 }} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />

      <div style={columnsStyle}>
        <ComponentColumn
          title="Additions" rows={additions} showBasic
          onChange={updateRow} onRemove={removeRow}
          onAdd={() => setRows((prev) => [...prev, newRow("Earning")])}
          addLabel="+ Add addition"
        />
        <ComponentColumn
          title="Deductions" rows={deductions} showBasic={false}
          onChange={updateRow} onRemove={removeRow}
          onAdd={() => setRows((prev) => [...prev, newRow("Deduction")])}
          addLabel="+ Add deduction"
        />
      </div>

      <div style={summaryCardStyle}>
        <SummaryRow label="Gross additions" value={currency(grossEarnings)} />
        <SummaryRow label="Total deductions" value={`-${currency(totalDeductions)}`} negative />
        <SummaryRow label="Net pay" value={currency(netPay)} bold />
      </div>

      {basicCount !== 1 && (
        <p style={{ fontSize: 12.5, color: "var(--warn)", margin: "12px 0 0" }}>
          Exactly one addition must be marked Basic — every % of Basic component, on either side, calculates off it.
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

function ComponentColumn({
  title, rows, showBasic, onChange, onRemove, onAdd, addLabel,
}: {
  title: string; rows: Row[]; showBasic: boolean;
  onChange: (key: string, patch: Partial<Row>) => void; onRemove: (key: string) => void;
  onAdd: () => void; addLabel: string;
}) {
  return (
    <div>
      <div style={columnHeaderStyle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {rows.length === 0 && <p style={{ fontSize: 12.5, color: "var(--faint)" }}>None yet.</p>}
        {rows.map((r) => (
          <div key={r.key} style={rowStyle}>
            <input
              style={{ ...s.field, marginBottom: 0 }} placeholder="Name"
              value={r.name} onChange={(e) => onChange(r.key, { name: e.target.value })}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <select
                style={{ ...s.field, marginBottom: 0, flex: 1 }} value={r.calculationType} disabled={r.isBasic}
                onChange={(e) => onChange(r.key, { calculationType: e.target.value as Row["calculationType"] })}
              >
                <option value="FixedAmount">Fixed amount</option>
                <option value="PercentageOfBasic">% of Basic</option>
              </select>
              <input
                type="number" min={0} step={0.01} style={{ ...s.field, marginBottom: 0, width: 85 }}
                value={r.value} onChange={(e) => onChange(r.key, { value: Number(e.target.value) })}
              />
              {showBasic && (
                <label style={basicLabelStyle}>
                  <input type="checkbox" checked={r.isBasic} onChange={(e) => onChange(r.key, { isBasic: e.target.checked })} />
                  Basic
                </label>
              )}
              <button type="button" style={removeButtonStyle} onClick={() => onRemove(r.key)}>×</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" style={addButtonStyle} onClick={onAdd}>{addLabel}</button>
    </div>
  );
}

function SummaryRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: bold ? 700 : 400 }}>
      <span style={{ fontSize: 13, color: bold ? "var(--ink)" : "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: bold ? 15 : 13.5, color: negative ? "var(--danger)" : bold ? "var(--accent)" : "var(--ink)" }}>{value}</span>
    </div>
  );
}

const columnsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 };
const columnHeaderStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase",
  color: "var(--faint)", marginBottom: 10,
};
const rowStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const basicLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" };
const removeButtonStyle: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: "var(--radius)",
  width: 28, height: 38, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0,
};
const addButtonStyle: React.CSSProperties = {
  background: "var(--surface-sunken)", color: "var(--ink)", border: "1px solid var(--border)",
  fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: "var(--radius)", cursor: "pointer", width: "100%",
};
const summaryCardStyle: React.CSSProperties = {
  background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
  padding: "12px 16px", marginBottom: 16,
};

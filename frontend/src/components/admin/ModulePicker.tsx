import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface ModuleDto { key: string; label: string; }

// Shared by PlanForm (which modules a plan includes) and NewClientForm/the client "change
// plan" dialog (which modules a "Custom" client gets) — one source of truth for the catalogue
// (GET /platform/modules, backed by ModuleCatalog on the backend) so the list can't drift.
export default function ModulePicker({ selected, onChange }: { selected: string[]; onChange: (keys: string[]) => void }) {
  const { data: modules } = useQuery({
    queryKey: ["platformModules"],
    queryFn: async () => (await api.get<ModuleDto[]>("/platform/modules")).data,
  });

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {(modules ?? []).map((m) => {
        const active = selected.includes(m.key);
        return (
          <button
            type="button"
            key={m.key}
            onClick={() => toggle(m.key)}
            style={{
              fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
              border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: active ? "var(--accent-soft)" : "var(--surface)",
              color: active ? "var(--accent)" : "var(--muted)",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

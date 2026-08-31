import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Drawer from "../components/Drawer";
import Spinner from "../components/Spinner";
import { pageStyles as s, tag } from "../styles/pageKit";

interface RoleRow {
  id: string;
  name: string;
  isSystemRole: boolean;
  isCustomized: boolean;
  permissions: string[];
  jobTitleCount: number;
}

interface PermissionItem {
  module: string;
  key: string;
}

export default function Roles() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermissions, setNewPermissions] = useState<Set<string>>(new Set());

  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get<RoleRow[]>("/roles")).data,
  });

  const permissions = useQuery({
    queryKey: ["roles", "permissions"],
    queryFn: async () => (await api.get<PermissionItem[]>("/roles/permissions")).data,
  });

  const grouped = groupByModule(permissions.data ?? []);

  const savePermissions = useMutation({
    mutationFn: ({ id, keys }: { id: string; keys: string[] }) =>
      api.patch(`/roles/${id}/permissions`, { permissions: keys }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  const createRole = useMutation({
    mutationFn: () => api.post("/roles", { name: newName, permissions: Array.from(newPermissions) }),
    onSuccess: () => {
      setNewName(""); setNewPermissions(new Set()); setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Roles & Permissions</h1>
          <p style={s.subtitle}>
            Every company's access rules are different — customize what each role can do here, or create a brand new role entirely.
          </p>
        </div>
        <button style={s.addButton} onClick={() => setDrawerOpen(true)}>New role</button>
      </header>

      {roles.isLoading && <Spinner />}

      {roles.data?.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          grouped={grouped}
          expanded={expanded === role.id}
          onToggle={() => setExpanded(expanded === role.id ? null : role.id)}
          onSave={(keys) => savePermissions.mutate({ id: role.id, keys })}
          onDelete={() => deleteRole.mutate(role.id)}
          deleteError={deleteRole.isError && deleteRole.variables === role.id
            ? ((deleteRole.error as any)?.response?.data ?? "Couldn't delete this role.")
            : null}
        />
      ))}

      <Drawer open={drawerOpen} title="New role" onClose={() => setDrawerOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            style={s.input} placeholder="Role name (e.g. Team Lead)"
            value={newName} onChange={(e) => setNewName(e.target.value)}
          />
          <PermissionChecklist
            grouped={grouped}
            selected={newPermissions}
            onChange={setNewPermissions}
          />
          {createRole.isError && (
            <p style={{ color: "var(--danger)", fontSize: 13 }}>
              {(createRole.error as any)?.response?.data ?? "Couldn't create this role."}
            </p>
          )}
          <button
            style={s.addButton}
            disabled={!newName.trim() || createRole.isPending}
            onClick={() => createRole.mutate()}
          >
            Create role
          </button>
        </div>
      </Drawer>
    </div>
  );
}

function RoleCard({
  role, grouped, expanded, onToggle, onSave, onDelete, deleteError,
}: {
  role: RoleRow;
  grouped: [string, PermissionItem[]][];
  expanded: boolean;
  onToggle: () => void;
  onSave: (keys: string[]) => void;
  onDelete: () => void;
  deleteError: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.permissions));
  const dirty = !setsEqual(selected, new Set(role.permissions));

  return (
    <section style={{ ...s.card, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: 0 }}>{role.name}</h2>
          {role.isSystemRole && <span style={tag("var(--surface-sunken)", "var(--faint)")}>System</span>}
          {role.isCustomized && <span style={tag("var(--warn-soft)", "var(--warn)")}>Customized</span>}
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{role.permissions.length} permissions</span>
          {role.jobTitleCount > 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>· {role.jobTitleCount} job title{role.jobTitleCount === 1 ? "" : "s"}</span>}
        </div>
        <span style={{ color: "var(--muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <PermissionChecklist grouped={grouped} selected={selected} onChange={setSelected} />
          {deleteError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{deleteError}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              style={s.addButton}
              disabled={!dirty}
              onClick={() => onSave(Array.from(selected))}
            >
              Save permissions
            </button>
            {!role.isSystemRole && (
              <button style={s.secondary} onClick={onDelete}>Delete role</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PermissionChecklist({
  grouped, selected, onChange,
}: {
  grouped: [string, PermissionItem[]][];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 420, overflowY: "auto" }}>
      {grouped.map(([module, items]) => (
        <div key={module}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            {module}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((p) => (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                {p.key}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByModule(items: PermissionItem[]): [string, PermissionItem[]][] {
  const map = new Map<string, PermissionItem[]>();
  for (const item of items) {
    const list = map.get(item.module) ?? [];
    list.push(item);
    map.set(item.module, list);
  }
  return Array.from(map.entries());
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

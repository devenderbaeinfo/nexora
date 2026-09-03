import { useEffect, useState } from "react";
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

interface ScopablePermission {
  permissionKey: string;
  allowedScopeTypes: string[];
}

interface RoleScope {
  permissionKey: string;
  scopeType: string;
  specificRecordIds: string[];
}

interface FieldCatalogItem {
  resource: string;
  fieldName: string;
}

interface RoleFieldPermission {
  resource: string;
  fieldName: string;
  access: string;
}

interface RecordOption {
  id: string;
  label: string;
}

interface ApprovalSettings {
  fallbackApproverEmployeeId: string | null;
  fallbackApproverName: string | null;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
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
      // A new custom role is also a new option in the "Select a role" dropdown on Job Titles
      // and Add Person — without this, both keep showing whatever they'd already cached.
      queryClient.invalidateQueries({ queryKey: ["assignableRoles"] });
      queryClient.invalidateQueries({ queryKey: ["jobTitles", "assignableRoles"] });
    },
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["jobTitles", "assignableRoles"] });
      queryClient.invalidateQueries({ queryKey: ["assignableRoles"] });
    },
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

      <ApprovalSettingsSection />
      <AttendanceSettingsSection />

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

// PPL-10: who covers leave/timesheet approval for someone with no reporting manager at all
// (the top of the org chart, or anyone PPL-7's "no manager" acknowledgment let through).
// Silently hidden for a caller without admin.manage_org_structure rather than erroring.
function ApprovalSettingsSection() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["approval-settings"],
    queryFn: async () => (await api.get<ApprovalSettings>("/approval-settings")).data,
    retry: false,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeOption[]>("/employees")).data,
    enabled: !settings.isError,
  });

  const [selected, setSelected] = useState("");
  useEffect(() => {
    setSelected(settings.data?.fallbackApproverEmployeeId ?? "");
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (fallbackApproverEmployeeId: string | null) =>
      api.put("/approval-settings", { fallbackApproverEmployeeId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approval-settings"] }),
  });

  if (settings.isError) return null;

  return (
    <section style={{ ...s.card, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 6px" }}>Fallback approver</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
        Covers leave and timesheet approval for anyone with no reporting manager set — otherwise
        those requests have no one to route to.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...s.select, minWidth: 260 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">— None configured —</option>
          {employees.data?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <button
          style={s.addButton}
          disabled={save.isPending || selected === (settings.data?.fallbackApproverEmployeeId ?? "")}
          onClick={() => save.mutate(selected || null)}
        >
          Save
        </button>
      </div>
    </section>
  );
}

// The workday length attendance splits Regular vs. Overtime hours against — different
// companies run 7/7.5/8/9-hour days, so this can't be a fixed number shared by every tenant.
// Silently hidden for a caller without admin.manage_org_structure rather than erroring.
function AttendanceSettingsSection() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["attendance-settings"],
    queryFn: async () => (await api.get<{ standardWorkDayHours: number }>("/attendance/settings")).data,
    retry: false,
  });

  const [hours, setHours] = useState("8");
  useEffect(() => {
    if (settings.data) setHours(String(settings.data.standardWorkDayHours));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (standardWorkDayHours: number) =>
      api.put("/attendance/settings", { standardWorkDayHours }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-settings"] }),
  });

  if (settings.isError) return null;

  const parsed = Number(hours);
  const valid = hours.trim() !== "" && parsed > 0 && parsed <= 24;

  return (
    <section style={{ ...s.card, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 6px" }}>Standard workday</h2>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
        Hours worked beyond this in a day count as overtime on attendance records.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="number" min={0.5} max={24} step={0.5}
          style={{ ...s.input, width: 100 }}
          value={hours} onChange={(e) => setHours(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>hours</span>
        <button
          style={s.addButton}
          disabled={!valid || save.isPending || parsed === settings.data?.standardWorkDayHours}
          onClick={() => save.mutate(parsed)}
        >
          Save
        </button>
      </div>
      {save.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>Couldn't save this setting.</p>
      )}
    </section>
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

          <DataScopeSection roleId={role.id} selectedPermissions={selected} />
          <FieldPermissionSection roleId={role.id} />
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

// Only shown for a permission the role actually has checked above — scoping a permission
// the role doesn't hold at all would be meaningless.
function DataScopeSection({ roleId, selectedPermissions }: { roleId: string; selectedPermissions: Set<string> }) {
  const scopable = useQuery({
    queryKey: ["roles", "scopable-permissions"],
    queryFn: async () => (await api.get<ScopablePermission[]>("/roles/scopable-permissions")).data,
  });
  const scopes = useQuery({
    queryKey: ["roles", roleId, "scopes"],
    queryFn: async () => (await api.get<RoleScope[]>(`/roles/${roleId}/scopes`)).data,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/projects")).data,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<{ id: string; firstName: string; lastName: string }[]>("/employees")).data,
  });
  const accounts = useQuery({
    queryKey: ["accounting", "accounts"],
    queryFn: async () => (await api.get<{ id: string; code: string; name: string }[]>("/accounting/accounts")).data,
  });

  const applicable = (scopable.data ?? []).filter((p) => selectedPermissions.has(p.permissionKey));
  if (applicable.length === 0) return null;

  // Accounts have no employee/department owner, so "Specific" for accounting.view picks from
  // the Chart of Accounts instead of the employee list every other scopable permission uses.
  const recordOptionsFor = (permissionKey: string): RecordOption[] => {
    if (permissionKey === "project.view") return (projects.data ?? []).map((p) => ({ id: p.id, label: p.name }));
    if (permissionKey === "accounting.view") return (accounts.data ?? []).map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` }));
    return (employees.data ?? []).map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` }));
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={sectionLabelStyle}>Data Scope</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {applicable.map((p) => (
          <ScopeRow
            key={p.permissionKey}
            roleId={roleId}
            permissionKey={p.permissionKey}
            allowedTypes={p.allowedScopeTypes}
            current={scopes.data?.find((sc) => sc.permissionKey === p.permissionKey)}
            recordOptions={recordOptionsFor(p.permissionKey)}
          />
        ))}
      </div>
    </div>
  );
}

function ScopeRow({
  roleId, permissionKey, allowedTypes, current, recordOptions,
}: {
  roleId: string;
  permissionKey: string;
  allowedTypes: string[];
  current: RoleScope | undefined;
  recordOptions: RecordOption[];
}) {
  const queryClient = useQueryClient();
  const [scopeType, setScopeType] = useState(current?.scopeType ?? "All");
  const [specificIds, setSpecificIds] = useState<Set<string>>(new Set(current?.specificRecordIds ?? []));

  useEffect(() => {
    setScopeType(current?.scopeType ?? "All");
    setSpecificIds(new Set(current?.specificRecordIds ?? []));
  }, [current]);

  const save = useMutation({
    mutationFn: () => api.put(`/roles/${roleId}/scopes/${permissionKey}`, {
      scopeType, specificRecordIds: scopeType === "Specific" ? Array.from(specificIds) : null,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles", roleId, "scopes"] }),
  });

  const toggleRecord = (id: string) => {
    const next = new Set(specificIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSpecificIds(next);
  };

  return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{permissionKey}</span>
        <select style={s.select} value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
          {allowedTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {scopeType === "Specific" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto", marginBottom: 10 }}>
          {recordOptions.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Nothing to pick from yet.</span>}
          {recordOptions.map((opt) => (
            <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
              <input type="checkbox" checked={specificIds.has(opt.id)} onChange={() => toggleRecord(opt.id)} />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      <button style={s.addButton} disabled={save.isPending} onClick={() => save.mutate()}>Save scope</button>
      {save.isError && (
        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--danger)" }}>
          {(save.error as any)?.response?.data ?? "Couldn't save this scope."}
        </span>
      )}
    </div>
  );
}

function FieldPermissionSection({ roleId }: { roleId: string }) {
  const catalog = useQuery({
    queryKey: ["roles", "field-catalog"],
    queryFn: async () => (await api.get<FieldCatalogItem[]>("/roles/field-catalog")).data,
  });
  const current = useQuery({
    queryKey: ["roles", roleId, "field-permissions"],
    queryFn: async () => (await api.get<RoleFieldPermission[]>(`/roles/${roleId}/field-permissions`)).data,
  });

  const byResource = new Map<string, FieldCatalogItem[]>();
  for (const item of catalog.data ?? []) {
    const list = byResource.get(item.resource) ?? [];
    list.push(item);
    byResource.set(item.resource, list);
  }
  if (byResource.size === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={sectionLabelStyle}>Field Access</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from(byResource.entries()).map(([resource, fields]) => (
          <FieldResourceRow key={resource} roleId={roleId} resource={resource} fields={fields} current={current.data ?? []} />
        ))}
      </div>
    </div>
  );
}

function FieldResourceRow({
  roleId, resource, fields, current,
}: {
  roleId: string;
  resource: string;
  fields: FieldCatalogItem[];
  current: RoleFieldPermission[];
}) {
  const queryClient = useQueryClient();
  const buildInitial = () => {
    const map: Record<string, string> = {};
    for (const f of fields) {
      map[f.fieldName] = current.find((c) => c.resource === resource && c.fieldName === f.fieldName)?.access ?? "View";
    }
    return map;
  };
  const [access, setAccess] = useState<Record<string, string>>(buildInitial);

  useEffect(() => { setAccess(buildInitial()); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => api.put(`/roles/${roleId}/field-permissions`, {
      resource,
      fields: Object.entries(access).map(([fieldName, acc]) => ({ fieldName, access: acc })),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles", roleId, "field-permissions"] }),
  });

  return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius)", padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{resource}</div>
      {fields.map((f) => (
        <div key={f.fieldName} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
          <span style={{ fontSize: 13 }}>{f.fieldName}</span>
          <select
            style={s.select}
            value={access[f.fieldName]}
            onChange={(e) => setAccess((a) => ({ ...a, [f.fieldName]: e.target.value }))}
          >
            <option value="Hidden">Hidden</option>
            <option value="View">View</option>
            <option value="Edit">Edit</option>
          </select>
        </div>
      ))}
      <button style={s.addButton} disabled={save.isPending} onClick={() => save.mutate()}>Save fields</button>
      {save.isError && (
        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--danger)" }}>
          {(save.error as any)?.response?.data ?? "Couldn't save field access."}
        </span>
      )}
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase",
  letterSpacing: ".04em", marginBottom: 8,
};

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

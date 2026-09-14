import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/Spinner";
import { pageStyles as s } from "../styles/pageKit";

interface ReportKeyCatalogItem {
  key: string;
  label: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  employeeId: string;
  name: string;
  email: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface ReportAccessGrant {
  id: string;
  roleId: string | null;
  roleName: string | null;
  userId: string | null;
  userName: string | null;
  reportKey: string;
  projectId: string | null;
  projectName: string | null;
}

// Admin-facing page for the "which specific roles/users/projects can see this report" layer
// on top of the flat Permission.Reports.* claim — see ReportAccessController on the backend.
// Mirrors the fetch/mutate patterns already established in Roles.tsx (same query-key style,
// same invalidate-on-success, same inline error surface under the button that triggered it).
export default function ReportAccess() {
  const queryClient = useQueryClient();

  const catalog = useQuery({
    queryKey: ["report-access", "catalog"],
    queryFn: async () => (await api.get<ReportKeyCatalogItem[]>("/report-access/catalog")).data,
  });
  const grants = useQuery({
    queryKey: ["report-access"],
    queryFn: async () => (await api.get<ReportAccessGrant[]>("/report-access")).data,
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get<RoleOption[]>("/roles")).data,
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<UserOption[]>("/users")).data,
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectOption[]>("/projects")).data,
  });

  const [reportKey, setReportKey] = useState("");
  const [granteeType, setGranteeType] = useState<"role" | "user">("role");
  const [roleId, setRoleId] = useState("");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.post("/report-access", {
        reportKey,
        roleId: granteeType === "role" ? roleId || null : null,
        userId: granteeType === "user" ? userId || null : null,
        projectId: projectId || null,
      }),
    onSuccess: () => {
      setReportKey(""); setRoleId(""); setUserId(""); setProjectId("");
      queryClient.invalidateQueries({ queryKey: ["report-access"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/report-access/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-access"] }),
  });

  const canSubmit = reportKey !== "" && (granteeType === "role" ? roleId !== "" : userId !== "");

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Report Access</h1>
          <p style={s.subtitle}>
            Every report starts open to anyone with its base permission. The moment you grant
            access here for a report, that report becomes restricted to only the roles/users
            you've granted — everyone else with the base permission loses access to it.
          </p>
        </div>
      </header>

      <section style={{ ...s.card, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 14px" }}>New grant</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
            Report
            <select style={s.select} value={reportKey} onChange={(e) => setReportKey(e.target.value)}>
              <option value="">— Select a report —</option>
              {catalog.data?.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>

          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="radio" checked={granteeType === "role"} onChange={() => setGranteeType("role")} />
              Grant to a role
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="radio" checked={granteeType === "user"} onChange={() => setGranteeType("user")} />
              Grant to a specific user
            </label>
          </div>

          {granteeType === "role" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
              Role
              <select style={s.select} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">— Select a role —</option>
                {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
              User
              <select style={s.select} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">— Select a user —</option>
                {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
            </label>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
            Project (optional — narrows to one project's data; leave blank for all)
            <select style={s.select} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— All projects —</option>
              {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          {create.isError && (
            <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>
              {(create.error as any)?.response?.data ?? "Couldn't create this grant."}
            </p>
          )}

          <button style={s.addButton} disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
            Grant access
          </button>
        </div>
      </section>

      <section>
        <h2 style={s.sectionTitle}>Existing grants</h2>
        {grants.isLoading && <Spinner />}
        {grants.data?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No grants configured yet — every report is still open to anyone with its base permission.
          </p>
        )}
        {grants.data && grants.data.length > 0 && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Report</th>
                  <th style={s.th}>Granted to</th>
                  <th style={s.th}>Project</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {grants.data.map((g) => (
                  <tr key={g.id}>
                    <td style={s.td}>{catalog.data?.find((c) => c.key === g.reportKey)?.label ?? g.reportKey}</td>
                    <td style={s.td}>
                      {g.roleId ? `Role: ${g.roleName ?? g.roleId}` : `User: ${g.userName ?? g.userId}`}
                    </td>
                    <td style={s.td}>{g.projectId ? (g.projectName ?? g.projectId) : "All projects"}</td>
                    <td style={s.td}>
                      <button style={s.secondary} disabled={remove.isPending} onClick={() => remove.mutate(g.id)}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

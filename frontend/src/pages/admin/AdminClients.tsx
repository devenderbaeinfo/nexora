import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import Drawer from "../../components/Drawer";
import NewClientForm from "./NewClientForm";
import ChangePlanForm from "./ChangePlanForm";
import StatusBadge from "../../components/admin/StatusBadge";
import { adminStyles as s } from "../../components/admin/adminStyles";
import Spinner from "../../components/Spinner";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAtUtc: string;
  planId: string | null;
  planName: string | null;
}

// Real data, not mock — this is the one Super Admin page backed by the actual tenant-
// provisioning API (PlatformController), since "who are my clients" has to be true, not
// a placeholder. User counts stay mock until usage tracking exists.
export default function AdminClients() {
  const [addOpen, setAddOpen] = useState(false);
  const [changePlanFor, setChangePlanFor] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["platformTenants"],
    queryFn: async () => (await api.get<TenantRow[]>("/platform/tenants")).data,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/platform/tenants/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platformTenants"] }),
  });

  return (
    <div>
      <header style={{ ...s.header, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={s.title}>Clients</h1>
          <p style={s.subtitle}>Every company running on NEXORA. No employee names, HR records, or internal client data ever surfaces here.</p>
        </div>
        <button style={styles.addButton} onClick={() => setAddOpen(true)}>Add client</button>
      </header>

      <Drawer open={addOpen} title="Add client" onClose={() => setAddOpen(false)}>
        <NewClientForm onDone={() => setAddOpen(false)} />
      </Drawer>

      <Drawer open={changePlanFor !== null} title="Change plan" onClose={() => setChangePlanFor(null)}>
        {changePlanFor !== null && <ChangePlanForm tenantId={changePlanFor} onDone={() => setChangePlanFor(null)} />}
      </Drawer>

      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load clients. Try refreshing.</p>}

      {data && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Company</th>
                <th style={s.th}>Workspace</th>
                <th style={s.th}>Plan</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Created</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr><td style={s.td} colSpan={6}>No clients yet — add your first one.</td></tr>
              )}
              {data.map((t) => (
                <tr key={t.id}>
                  <td style={s.td}><div style={{ fontWeight: 600, color: "var(--ink)" }}>{t.name}</div></td>
                  <td style={{ ...s.td, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{t.slug}</td>
                  <td style={s.td}>
                    <button type="button" style={styles.planButton} onClick={() => setChangePlanFor(t.id)}>
                      {t.planName ?? "Custom"}
                    </button>
                  </td>
                  <td style={s.td}><StatusBadge status={t.status} /></td>
                  <td style={s.td}>{new Date(t.createdAtUtc).toLocaleDateString()}</td>
                  <td style={s.td}>
                    {t.status === "Suspended" ? (
                      <button
                        style={styles.activateButton}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: t.id, status: "Active" })}
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        style={styles.suspendButton}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: t.id, status: "Suspended" })}
                      >
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  suspendButton: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  activateButton: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  planButton: {
    background: "var(--accent-soft)", color: "var(--accent)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

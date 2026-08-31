import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import Drawer from "../../components/Drawer";
import { adminStyles as s } from "../../components/admin/adminStyles";
import { formStyles as f } from "../../components/formStyles";
import Spinner from "../../components/Spinner";

interface SuperAdminRow {
  id: string;
  email: string;
  isActive: boolean;
}

// The platform's own operator accounts — separate from any tenant's Admin. Nothing above
// this: whoever already holds platform.manage_tenants can create or deactivate another one,
// there's no further approval chain to check against.
export default function AdminSuperAdmins() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["platformSuperAdmins"],
    queryFn: async () => (await api.get<SuperAdminRow[]>("/platform/superadmins")).data,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/superadmins/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platformSuperAdmins"] }),
  });

  const activeCount = data?.filter((u) => u.isActive).length ?? 0;
  const deactivatedCount = (data?.length ?? 0) - activeCount;

  return (
    <div>
      <header style={{ ...s.header, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={s.title}>Super Admins</h1>
          <p style={s.subtitle}>Platform-operator accounts. Anyone here can provision or suspend any client tenant — the top of the hierarchy, with no approval chain above it.</p>
        </div>
        <button style={styles.addButton} onClick={() => setAddOpen(true)}>
          <PlusIcon /> Add Super Admin
        </button>
      </header>

      <Drawer open={addOpen} title="Add Super Admin" onClose={() => setAddOpen(false)}>
        <NewSuperAdminForm onDone={() => setAddOpen(false)} />
      </Drawer>

      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load Super Admins. Try refreshing.</p>}

      {data && (
        <>
          <div style={styles.statRow}>
            <div style={styles.statCard} className="card-surface">
              <span style={styles.statLabel}>Total accounts</span>
              <span style={styles.statValue}>{data.length}</span>
            </div>
            <div style={styles.statCard} className="card-surface">
              <span style={styles.statLabel}>Active</span>
              <span style={{ ...styles.statValue, color: "var(--good)" }}>{activeCount}</span>
            </div>
            <div style={styles.statCard} className="card-surface">
              <span style={styles.statLabel}>Deactivated</span>
              <span style={{ ...styles.statValue, color: "var(--faint)" }}>{deactivatedCount}</span>
            </div>
          </div>

          {data.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}><ShieldIcon /></div>
              <h3 style={styles.emptyTitle}>No Super Admins yet</h3>
              <p style={styles.emptyText}>Add the first platform-operator account to start provisioning client tenants.</p>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Account</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((u) => (
                    <tr key={u.id}>
                      <td style={s.td}>
                        <div style={styles.accountCell}>
                          <div style={{ ...styles.avatar, opacity: u.isActive ? 1 : 0.5 }}>
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{u.email}</span>
                        </div>
                      </td>
                      <td style={s.td}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 9px", borderRadius: 20,
                          background: u.isActive ? "var(--good-soft)" : "var(--surface-sunken)",
                          color: u.isActive ? "var(--good)" : "var(--faint)",
                        }}>
                          {u.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td style={s.td}>
                        {u.isActive && (
                          <button
                            style={styles.deactivateButton}
                            disabled={deactivate.isPending}
                            onClick={() => deactivate.mutate(u.id)}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewSuperAdminForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/platform/superadmins", { email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platformSuperAdmins"] });
      onDone();
    },
    onError: (err: any) => {
      setError(err?.response?.status === 409
        ? "Someone with this email already exists."
        : (err?.response?.data ?? "Couldn't create this account."));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate();
  };

  return (
    <form onSubmit={onSubmit}>
      <label style={f.label} htmlFor="email">Email</label>
      <input id="email" type="email" style={f.field} value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label style={f.label} htmlFor="password">Password</label>
      <input id="password" type="password" style={f.field} value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />

      {error && <div style={f.error} role="alert">{error}</div>}

      <div style={f.actions}>
        <button type="button" style={f.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={f.button} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create account"}
        </button>
      </div>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z" />
      <path d="m9 12 2 2 4.5-4.5" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  addButton: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  statRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 },
  statCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: "18px 20px", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 6,
  },
  statLabel: { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--faint)" },
  statValue: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--ink)" },
  accountCell: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 32, height: 32, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13.5, flexShrink: 0,
  },
  deactivateButton: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8,
    padding: "56px 24px", background: "var(--surface)", border: "1px dashed var(--border-strong)",
    borderRadius: "var(--radius-lg)",
  },
  emptyIcon: {
    width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: 0 },
  emptyText: { fontSize: 13.5, color: "var(--muted)", margin: 0, maxWidth: 340 },
};

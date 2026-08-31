import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formStyles as s } from "../../components/formStyles";

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface CreatedClient { slug: string; adminEmail: string; adminPassword: string; }

export default function NewClientForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();

  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedClient | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/platform/tenants", { tenantName, tenantSlug, adminEmail, adminPassword, adminDisplayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platformTenants"] });
      setCreated({ slug: tenantSlug, adminEmail, adminPassword });
    },
    onError: (err: any) => {
      setError(err?.response?.status === 409
        ? "That workspace name is already taken — try a different one."
        : (err?.response?.data ?? "Couldn't create this client. Check the fields and try again."));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  if (created) {
    return (
      <div>
        <div style={{ ...s.error, background: "var(--good-soft)", color: "var(--good)" }}>
          Client created. Sign out and log in as their Admin to see the full client-side view:
        </div>
        <dl style={{ fontSize: 13.5, lineHeight: 1.9, margin: "16px 0" }}>
          <dt style={{ color: "var(--muted)" }}>Workspace</dt>
          <dd style={{ margin: "0 0 8px", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{created.slug}</dd>
          <dt style={{ color: "var(--muted)" }}>Admin email</dt>
          <dd style={{ margin: "0 0 8px", fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{created.adminEmail}</dd>
          <dt style={{ color: "var(--muted)" }}>Admin password</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{created.adminPassword}</dd>
        </dl>
        <div style={s.actions}>
          <button type="button" style={s.button} onClick={onDone}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label style={s.label} htmlFor="tenantName">Company name</label>
      <input
        id="tenantName" style={s.field} value={tenantName}
        onChange={(e) => {
          setTenantName(e.target.value);
          if (!slugTouched) setTenantSlug(slugify(e.target.value));
        }}
        required
      />

      <label style={s.label} htmlFor="tenantSlug">Workspace slug</label>
      <input
        id="tenantSlug" style={s.field} value={tenantSlug}
        onChange={(e) => { setTenantSlug(slugify(e.target.value)); setSlugTouched(true); }}
        required
      />

      <label style={s.label} htmlFor="adminDisplayName">Admin's name</label>
      <input id="adminDisplayName" style={s.field} value={adminDisplayName} onChange={(e) => setAdminDisplayName(e.target.value)} required />

      <label style={s.label} htmlFor="adminEmail">Admin's email</label>
      <input id="adminEmail" type="email" style={s.field} value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />

      <label style={s.label} htmlFor="adminPassword">Admin's temporary password</label>
      <input id="adminPassword" type="password" style={s.field} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} minLength={12} required />

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create client"}
        </button>
      </div>
    </form>
  );
}

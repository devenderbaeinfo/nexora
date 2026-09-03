import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function ForcedPasswordChange() {
  const { completePasswordChange, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post("/auth/change-password", { currentPassword, newPassword });
      completePasswordChange(data.accessToken, data.displayName, data.role, data.permissions, data.baseCurrencyCode);
    } catch (err: any) {
      setError(err?.response?.data ?? "Couldn't change your password. Check the current password and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card} className="card-surface">
        <h1 style={styles.title}>Set a new password</h1>
        <p style={styles.subtitle}>
          Either this is a temporary password from a reset, or it's been 6 months since you last changed it.
          Set a new one to continue.
        </p>

        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="currentPassword">Current password</label>
          <input
            id="currentPassword" type="password" style={styles.field}
            value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password" required
          />

          <label style={styles.label} htmlFor="newPassword">New password</label>
          <input
            id="newPassword" type="password" style={styles.field}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password" minLength={12} required
          />

          <label style={styles.label} htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm" type="password" style={styles.field}
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password" minLength={12} required
          />

          {error && <div style={styles.error} role="alert">{String(error)}</div>}

          <button type="submit" style={styles.button} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Set password and continue"}
          </button>
          <button type="button" style={styles.linkButton} onClick={logout}>Sign out instead</button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 },
  card: {
    width: "100%", maxWidth: 400, background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: 36, boxShadow: "var(--shadow)",
  },
  title: { fontSize: 22, fontWeight: 600, marginBottom: 10 },
  subtitle: { color: "var(--muted)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 26px" },
  form: { display: "flex", flexDirection: "column" },
  label: {
    fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em",
    textTransform: "uppercase", color: "var(--muted)", marginBottom: 6,
  },
  field: {
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "11px 12px", fontSize: 14,
    color: "var(--ink)", marginBottom: 16, width: "100%",
  },
  button: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, padding: 12,
    borderRadius: "var(--radius)", cursor: "pointer", marginTop: 6,
  },
  linkButton: {
    background: "none", border: "none", color: "var(--muted)", fontSize: 13,
    cursor: "pointer", marginTop: 14, textDecoration: "underline",
  },
  error: {
    background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13,
    padding: "10px 12px", borderRadius: "var(--radius)", marginBottom: 16,
  },
};

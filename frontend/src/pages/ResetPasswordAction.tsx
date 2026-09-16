import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function ResetPasswordAction({ userId, label, requested }: { userId: string; label: string; requested?: boolean }) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (newPassword: string) => api.post(`/users/${userId}/reset-password`, { newPassword }),
    onError: () => setError("Couldn't reset this password — you may not have permission for this account."),
  });

  const onClick = () => {
    setError(null);
    const generated = generateTempPassword();
    mutation.mutate(generated, { onSuccess: () => setTempPassword(generated) });
  };

  if (tempPassword) {
    return (
      <div style={styles.result}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Temporary password for {label} — share this once, it won't be shown again:</div>
        <code style={styles.code}>{tempPassword}</code>
      </div>
    );
  }

  return (
    <div>
      {requested && (
        <div style={{ color: "var(--danger)", fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
          Requested a password reset
        </div>
      )}
      <button style={requested ? styles.buttonRequested : styles.button} onClick={onClick} disabled={mutation.isPending}>
        {mutation.isPending ? "Resetting…" : "Reset password"}
      </button>
      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    background: "none", border: "1px solid var(--border)", color: "var(--muted)",
    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  // The account flagged itself via the public "forgot password" form — this is the one
  // signal an admin/HR gets that someone is actually waiting on them, so it reads as
  // urgent (solid red) rather than the same quiet outline every other row gets.
  buttonRequested: {
    background: "var(--danger)", border: "1px solid var(--danger)", color: "white",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  result: {
    background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: "var(--radius)",
    padding: "10px 12px",
  },
  code: {
    fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent)", wordBreak: "break-all",
  },
};

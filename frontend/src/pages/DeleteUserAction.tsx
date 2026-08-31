import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function DeleteUserAction({ userId, label }: { userId: string; label: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.delete(`/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: () => setError("Couldn't remove this account — you can only remove accounts you created."),
  });

  if (confirming) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Remove {label}?</span>
        <button style={styles.confirm} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Removing…" : "Confirm"}
        </button>
        <button style={styles.cancel} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div>
      <button style={styles.button} onClick={() => { setError(null); setConfirming(true); }}>Remove</button>
      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    background: "none", border: "1px solid var(--border)", color: "var(--danger)",
    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  confirm: {
    background: "var(--danger-soft)", border: "none", color: "var(--danger)",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  cancel: {
    background: "none", border: "1px solid var(--border)", color: "var(--muted)",
    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

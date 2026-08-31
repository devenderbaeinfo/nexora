import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  createdAtUtc: string;
}

export default function Announcements() {
  const { can } = useAuth();
  const canManage = can("announcements.manage");
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"Announcement" | "Policy">("Announcement");
  const [isPinned, setIsPinned] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await api.get<AnnouncementRow[]>("/announcements")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/announcements", { title, body, category, isPinned }),
    onSuccess: () => {
      setTitle(""); setBody(""); setCategory("Announcement"); setIsPinned(false);
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Announcements & Policies</h1>
          <p style={styles.subtitle}>Company-wide notices and policies — POSH, leave conditions, and anything else HR needs everyone to see.</p>
        </div>
      </header>

      {canManage && (
        <section style={styles.formCard} className="card-surface">
          <h2 style={styles.sectionTitle}>Publish new</h2>
          <div style={styles.formRow}>
            <input style={styles.input} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select style={styles.select} value={category} onChange={(e) => setCategory(e.target.value as "Announcement" | "Policy")}>
              <option value="Announcement">Announcement</option>
              <option value="Policy">Policy</option>
            </select>
            <label style={styles.checkboxLabel}>
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
              Pin to top
            </label>
          </div>
          <textarea style={styles.textarea} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <button
            style={styles.addButton}
            disabled={!title.trim() || !body.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Publish
          </button>
        </section>
      )}

      {isLoading && <Spinner />}

      {!isLoading && (!data || data.length === 0) && (
        <p style={{ color: "var(--muted)" }}>No announcements yet.</p>
      )}

      <div style={styles.list}>
        {data?.map((a) => (
          <div key={a.id} style={styles.card} className="card-surface">
            <div style={styles.cardHeader}>
              <span style={{ ...styles.tag, ...(a.category === "Policy" ? styles.policyTag : {}) }}>
                {a.category}{a.isPinned ? " · Pinned" : ""}
              </span>
              {canManage && (
                <button style={styles.deleteButton} onClick={() => remove.mutate(a.id)}>Delete</button>
              )}
            </div>
            <h3 style={styles.cardTitle}>{a.title}</h3>
            <p style={styles.cardBody}>{a.body}</p>
            <span style={styles.cardDate}>{new Date(a.createdAtUtc).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 520 },
  formCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, marginBottom: 28, boxShadow: "var(--shadow)",
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  formRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, alignItems: "center" },
  input: {
    flex: 1, minWidth: 200, background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  select: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" },
  textarea: {
    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: "9px 12px", fontSize: 13, color: "var(--ink)",
    marginBottom: 10, resize: "vertical", fontFamily: "var(--font-body)",
  },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, boxShadow: "var(--shadow)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tag: {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase",
    background: "var(--accent-soft)", color: "var(--accent)", padding: "3px 9px", borderRadius: 12,
  },
  policyTag: { background: "var(--warn-soft)", color: "var(--warn)" },
  deleteButton: {
    background: "var(--danger-soft)", color: "var(--danger)", border: "none",
    fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: "var(--ink)" },
  cardBody: { fontSize: 13.5, color: "var(--muted)", margin: "0 0 8px", whiteSpace: "pre-wrap" },
  cardDate: { fontSize: 11.5, color: "var(--faint)" },
};

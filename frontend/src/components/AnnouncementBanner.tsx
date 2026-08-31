import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  createdAtUtc: string;
}

// Shown at the top of every page in the client shell — pinned policies (POSH, leave
// conditions, etc.) surface first, then the two most recent plain announcements.
export default function AnnouncementBanner() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await api.get<AnnouncementRow[]>("/announcements")).data,
  });

  if (!data || data.length === 0) return null;

  const featured = data.slice(0, 3);

  return (
    <div style={styles.wrap}>
      {featured.map((a) => (
        <div key={a.id} style={styles.item}>
          <span style={{ ...styles.tag, ...(a.category === "Policy" ? styles.policyTag : {}) }}>
            {a.category === "Policy" ? "Policy" : "Announcement"}
          </span>
          <span style={styles.title}>{a.title}</span>
          <span style={styles.body}>{a.body}</span>
        </div>
      ))}
      <Link to="/announcements" style={styles.link}>View all →</Link>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    background: "var(--surface-sunken)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 24,
    display: "flex", flexDirection: "column", gap: 6,
  },
  item: { display: "flex", alignItems: "baseline", gap: 8, fontSize: 13, flexWrap: "wrap" },
  tag: {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase",
    background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 8px", borderRadius: 12, flexShrink: 0,
  },
  policyTag: { background: "var(--warn-soft)", color: "var(--warn)" },
  title: { fontWeight: 700, color: "var(--ink)" },
  body: { color: "var(--muted)" },
  link: { fontSize: 12.5, fontWeight: 600, color: "var(--accent)", textDecoration: "none", alignSelf: "flex-end" },
};

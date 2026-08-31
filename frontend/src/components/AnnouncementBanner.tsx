import { useState } from "react";
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

// Lives in the sidebar now, not at the top of every page — a bell with a count badge that
// expands into the same pinned-first, most-recent-next list the old top banner showed.
export default function AnnouncementBanner() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await api.get<AnnouncementRow[]>("/announcements")).data,
  });

  const items = data ?? [];
  const count = items.length;
  if (count === 0) return null;

  const featured = items.slice(0, 3);

  return (
    <div style={styles.wrap}>
      <button style={styles.trigger} onClick={() => setOpen((v) => !v)}>
        <span style={styles.triggerLeft}>
          <BellIcon />
          Announcements
        </span>
        <span style={styles.badge}>{count > 9 ? "9+" : count}</span>
      </button>

      {open && (
        <div style={styles.panel}>
          {featured.map((a) => (
            <div key={a.id} style={styles.item}>
              <span style={{ ...styles.tag, ...(a.category === "Policy" ? styles.policyTag : {}) }}>
                {a.category === "Policy" ? "Policy" : "Announcement"}
              </span>
              <span style={styles.title}>{a.title}</span>
              <span style={styles.body}>{a.body}</span>
            </div>
          ))}
          <Link to="/announcements" style={styles.link} onClick={() => setOpen(false)}>View all →</Link>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2.5h16z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { position: "relative", marginTop: 12 },
  trigger: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "10px 12px", cursor: "pointer", font: "inherit", color: "var(--ink)",
  },
  triggerLeft: { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 },
  badge: {
    background: "var(--danger)", color: "#fff", fontSize: 10.5, fontWeight: 700, lineHeight: 1,
    borderRadius: 999, padding: "3px 6px", minWidth: 16, textAlign: "center",
  },
  panel: {
    marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8,
  },
  item: { display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5 },
  tag: {
    fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase",
    background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 7px", borderRadius: 12,
    alignSelf: "flex-start",
  },
  policyTag: { background: "var(--warn-soft)", color: "var(--warn)" },
  title: { fontWeight: 700, color: "var(--ink)" },
  body: { color: "var(--muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  link: { fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", alignSelf: "flex-end" },
};

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface SearchResult {
  kind: string;
  title: string;
  subtitle: string;
  id: string;
  linkPath: string;
}

// Global Ctrl+K / Cmd+K search — jump straight to a person or project instead of hunting
// through a role-specific sidebar. Debounced against the backend's /api/search, which already
// filters results down to whatever the caller's own permissions would let them see anyway.
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(""); setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: async () => (await api.get<SearchResult[]>("/search", { params: { q: debounced } })).data,
    enabled: open && debounced.trim().length >= 2,
  });

  const results = data ?? [];

  const goTo = (r: SearchResult) => {
    setOpen(false);
    navigate(r.linkPath);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(results.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter" && results[activeIndex]) { e.preventDefault(); goTo(results[activeIndex]); }
  };

  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={() => setOpen(false)}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search">
        <input
          ref={inputRef}
          style={styles.input}
          placeholder="Search people, projects…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
        />

        {query.trim().length >= 2 && results.length === 0 && (
          <div style={styles.empty}>No matches for "{query}".</div>
        )}

        {results.length > 0 && (
          <div style={styles.list}>
            {results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                style={{ ...styles.item, ...(i === activeIndex ? styles.itemActive : {}) }}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => goTo(r)}
              >
                <span style={styles.itemKind}>{r.kind}</span>
                <span style={styles.itemTitle}>{r.title}</span>
                <span style={styles.itemSubtitle}>{r.subtitle}</span>
              </button>
            ))}
          </div>
        )}

        <div style={styles.footer}>
          <span><kbd style={styles.kbd}>↑</kbd><kbd style={styles.kbd}>↓</kbd> navigate</span>
          <span><kbd style={styles.kbd}>↵</kbd> open</span>
          <span><kbd style={styles.kbd}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(10,10,14,.45)", zIndex: 100,
    display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh",
  },
  panel: {
    width: "min(560px, 92vw)", background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", overflow: "hidden",
  },
  input: {
    width: "100%", border: "none", borderBottom: "1px solid var(--border)", background: "none",
    color: "var(--ink)", fontSize: 16, padding: "16px 20px", outline: "none", boxSizing: "border-box",
  },
  empty: { padding: "24px 20px", fontSize: 13.5, color: "var(--muted)" },
  list: { maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", padding: 6 },
  item: {
    display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 12px",
    background: "none", border: "none", borderRadius: "var(--radius)", cursor: "pointer", font: "inherit",
  },
  itemActive: { background: "var(--accent-soft)" },
  itemKind: {
    fontSize: 10.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase",
    letterSpacing: ".03em", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: 6, flexShrink: 0,
  },
  itemTitle: { fontSize: 14, fontWeight: 600, color: "var(--ink)" },
  itemSubtitle: { fontSize: 12.5, color: "var(--faint)", marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  footer: {
    display: "flex", gap: 16, padding: "10px 16px", borderTop: "1px solid var(--border)",
    fontSize: 11.5, color: "var(--faint)",
  },
  kbd: {
    display: "inline-block", background: "var(--surface-2)", border: "1px solid var(--border-strong)",
    borderRadius: 4, padding: "1px 5px", fontFamily: "var(--font-mono)", fontSize: 10.5, marginRight: 4,
  },
};

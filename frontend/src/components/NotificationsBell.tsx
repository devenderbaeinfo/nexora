import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { groupPendingItems, type NotificationItem } from "./ActionCenter";

const SEEN_KEY = "nexora.notifications.seen";
const itemKey = (i: NotificationItem) => `${i.kind}-${i.id}`;

function loadSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // best-effort only — a toast repeating once after a private-browsing session isn't worth surfacing an error for
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Polls the pending-approvals aggregate every 30s — cheap (a handful of small queries server
// side) and simple, versus standing up a push channel for what's fundamentally a "did anything
// new show up" check. Items that require action are grouped into count+Review rows (same
// grouping the dashboard's Action Center uses); FYI items ("your own request was decided")
// stay a flat recent feed underneath — the two are different enough not to share one list.
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notifications", "pending-approvals"],
    queryFn: async () => (await api.get<NotificationItem[]>("/notifications/pending-approvals")).data,
    refetchInterval: 30_000,
  });

  const items = data ?? [];
  const groups = groupPendingItems(items);
  const recent = items.filter((i) => !i.requiresAction).slice(0, 8);
  const count = groups.reduce((sum, g) => sum + g.count, 0);

  // LVA-13/PRJ-8: surface a fresh FYI item (a leave decision, a task assignment) as a toast
  // the moment a poll turns it up, instead of making the employee open the bell to notice.
  // Seen ids persist in localStorage so a reload doesn't replay the last 14 days of history —
  // only genuinely new items after the first load ever toast.
  const seenRef = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<{ key: string; kind: string; label: string }[]>([]);

  useEffect(() => {
    if (!data) return;
    if (seenRef.current === null) {
      const stored = loadSeen();
      seenRef.current = new Set(stored.length ? stored : data.map(itemKey));
      if (!stored.length) saveSeen(seenRef.current);
      return;
    }

    const fresh = data.filter((i) => !i.requiresAction && !seenRef.current!.has(itemKey(i)));
    if (fresh.length === 0) return;

    setToasts((prev) => [...prev, ...fresh.map((i) => ({ key: itemKey(i), kind: i.kind, label: i.label }))]);
    for (const i of fresh) seenRef.current.add(itemKey(i));
    saveSeen(seenRef.current);
  }, [data]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts((prev) => prev.slice(1)), 6000);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <>
    {toasts.length > 0 && (
      <div style={styles.toastStack}>
        {toasts.map((t) => (
          <div key={t.key} style={styles.toast}>
            <div style={styles.itemKind}>{t.kind}</div>
            <div style={styles.itemLabel}>{t.label}</div>
          </div>
        ))}
      </div>
    )}
    <div
      style={styles.wrap}
      onMouseEnter={() => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setOpen(false), 150);
      }}
    >
      <button style={styles.bellButton} aria-label="Notifications">
        <BellIcon />
        {count > 0 && <span style={styles.badge}>{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>Notifications</div>
          {items.length === 0 && <div style={styles.empty}>You're all caught up.</div>}

          {groups.length > 0 && (
            <div style={styles.groupList}>
              {groups.map((g) => (
                <button
                  key={g.kind}
                  style={styles.groupRow}
                  onClick={() => { setOpen(false); navigate(g.linkPath); }}
                >
                  <span style={styles.groupCount}>{g.count}</span>
                  <span style={styles.groupLabel}>{g.kind} {g.count === 1 ? "item" : "items"} waiting on you</span>
                  <span style={styles.groupReview}>Review</span>
                </button>
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <>
              <div style={styles.recentHeader}>Recent</div>
              <div style={styles.list}>
                {recent.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    style={styles.item}
                    onClick={() => { setOpen(false); navigate(item.linkPath); }}
                  >
                    <div style={styles.itemKind}>{item.kind}</div>
                    <div style={styles.itemLabel}>{item.label}</div>
                    <div style={styles.itemTime}>{timeAgo(item.createdAtUtc)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2.5h16z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toastStack: {
    position: "fixed", bottom: 20, right: 20, zIndex: 100,
    display: "flex", flexDirection: "column", gap: 8, width: 300,
  },
  toast: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow)", padding: "12px 14px",
  },
  wrap: { position: "relative" },
  bellButton: {
    position: "relative", background: "none", border: "none", color: "var(--muted)",
    cursor: "pointer", padding: 6, borderRadius: "var(--radius)", display: "flex",
  },
  badge: {
    position: "absolute", top: 0, right: 0, background: "var(--danger)", color: "#fff",
    fontSize: 10, fontWeight: 700, lineHeight: 1, borderRadius: 999, padding: "3px 5px",
    minWidth: 15, textAlign: "center",
  },
  panel: {
    position: "absolute", top: "calc(100% + 10px)", right: 0, width: 340,
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow)", zIndex: 60, overflow: "hidden",
  },
  panelHeader: {
    padding: "12px 16px", fontSize: 12.5, fontWeight: 700, color: "var(--faint)",
    textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid var(--border)",
  },
  empty: { padding: "20px 16px", fontSize: 13.5, color: "var(--muted)" },
  groupList: { display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border)" },
  groupRow: {
    display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 16px",
    background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
    font: "inherit", color: "var(--ink)",
  },
  groupCount: {
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--accent)",
    background: "var(--accent-soft)", borderRadius: 999, minWidth: 24, textAlign: "center", padding: "2px 6px",
  },
  groupLabel: { fontSize: 13, fontWeight: 500, flex: 1 },
  groupReview: { fontSize: 11.5, fontWeight: 700, color: "var(--accent)" },
  recentHeader: {
    padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--faint)",
    textTransform: "uppercase", letterSpacing: ".04em",
  },
  list: { maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column" },
  item: {
    display: "flex", flexDirection: "column", gap: 2, textAlign: "left", padding: "10px 16px",
    background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer",
    font: "inherit", color: "var(--ink)",
  },
  itemKind: { fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".03em" },
  itemLabel: { fontSize: 13.5, fontWeight: 500 },
  itemTime: { fontSize: 11.5, color: "var(--faint)" },
};

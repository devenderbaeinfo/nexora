import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface NotificationItem {
  kind: string;
  label: string;
  id: string;
  createdAtUtc: string;
  linkPath: string;
  requiresAction: boolean;
}

export interface ActionGroup { kind: string; count: number; linkPath: string; }

// Groups the same pending-approval feed the notifications bell polls into "N Leave
// Requests -> Review" cards — the spec's Action Center: a count you can act on beats a
// pile of individual line items. FYI items (someone's own request just got decided) are
// deliberately excluded; those stay a flat feed, not a card with a count.
export function groupPendingItems(items: NotificationItem[]): ActionGroup[] {
  const groups: ActionGroup[] = [];
  for (const item of items) {
    if (!item.requiresAction) continue;
    const existing = groups.find((g) => g.kind === item.kind);
    if (existing) existing.count += 1;
    else groups.push({ kind: item.kind, count: 1, linkPath: item.linkPath });
  }
  return groups;
}

export function useActionGroups() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "pending-approvals"],
    queryFn: async () => (await api.get<NotificationItem[]>("/notifications/pending-approvals")).data,
    refetchInterval: 30_000,
  });

  return { groups: groupPendingItems(data ?? []), isLoading };
}

export default function ActionCenter({ groups }: { groups: ActionGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={styles.title}>Requires your attention</h2>
      <div style={styles.grid}>
        {groups.map((g) => (
          <div key={g.kind} style={styles.card}>
            <div>
              <div style={styles.count}>{g.count}</div>
              <div style={styles.label}>{g.kind} {g.count === 1 ? "item" : "items"}</div>
            </div>
            <Link to={g.linkPath} style={styles.reviewButton}>Review</Link>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 },
  card: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, boxShadow: "var(--shadow)", display: "flex",
    alignItems: "center", justifyContent: "space-between", gap: 12,
  },
  count: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--accent)" },
  label: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  reviewButton: {
    textDecoration: "none", background: "var(--accent-soft)", color: "var(--accent)",
    fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: "var(--radius)", whiteSpace: "nowrap",
  },
};

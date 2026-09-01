import { useMemo, useState } from "react";
import Spinner from "./Spinner";

// A generic enterprise-table shell — search, sort, pagination, row selection, and CSV
// export — so every entity list (People today, Projects/AuditLog/etc. next) gets the same
// behavior instead of each page hand-rolling its own <table> with none of it. Sorting/search/
// pagination all run client-side against `rows`, which is fine at the row counts these lists
// currently carry; if a list grows past what the API returns unbounded, that's a backend
// pagination change, not something this component can paper over.
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  // Used for both sorting and search matching. Omit to make a column display-only.
  value?: (row: T) => string | number;
  width?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  errorMessage?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  selectable?: boolean;
  bulkActions?: (selectedIds: string[]) => React.ReactNode;
  exportFileName?: string;
  pageSize?: number;
}

type SortDir = "asc" | "desc";

export default function DataTable<T>({
  columns, rows, rowKey, isLoading, error, errorMessage, emptyMessage = "Nothing here yet.",
  searchPlaceholder = "Search…", selectable, bulkActions, exportFileName, pageSize = 10,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => c.value && String(c.value(row)).toLowerCase().includes(q)));
  }, [rows, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.value!(a), bv = col.value!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  const pageIds = pageRows.map(rowKey);

  const toggleSort = (key: string) => {
    setPage(1);
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const exportCsv = () => {
    const header = columns.filter((c) => c.value).map((c) => c.header);
    const exportCols = columns.filter((c) => c.value);
    const lines = sorted.map((row) =>
      exportCols.map((c) => `"${String(c.value!(row)).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Spinner />;
  if (error) return <p style={{ color: "var(--danger)" }}>{errorMessage ?? "Couldn't load this list. Try refreshing."}</p>;

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        />
        {exportFileName && (
          <button style={styles.exportButton} onClick={exportCsv} disabled={sorted.length === 0}>
            Export CSV
          </button>
        )}
      </div>

      {selectable && selected.size > 0 && bulkActions && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selected.size} selected</span>
          <div style={{ display: "flex", gap: 8 }}>{bulkActions([...selected])}</div>
        </div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {selectable && (
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    checked={pageIds.length > 0 && pageIds.every((id) => selected.has(id))}
                    onChange={toggleAllOnPage}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ ...styles.th, width: c.width, cursor: c.value ? "pointer" : "default" }}
                  onClick={() => c.value && toggleSort(c.key)}
                >
                  {c.header}
                  {sortKey === c.key && <span style={styles.sortArrow}>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td style={styles.td} colSpan={columns.length + (selectable ? 1 : 0)}>
                {query.trim() ? `No matches for "${query}".` : emptyMessage}
              </td></tr>
            )}
            {pageRows.map((row) => {
              const id = rowKey(row);
              return (
                <tr key={id}>
                  {selectable && (
                    <td style={styles.td}>
                      <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
                    </td>
                  )}
                  {columns.map((c) => <td key={c.key} style={styles.td}>{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div style={styles.pagination}>
          <span style={styles.pageInfo}>
            {(clampedPage - 1) * pageSize + 1}–{Math.min(clampedPage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={{ ...styles.pageButton, ...(clampedPage <= 1 ? styles.pageButtonDisabled : {}) }}
              disabled={clampedPage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <button
              style={{ ...styles.pageButton, ...(clampedPage >= pageCount ? styles.pageButtonDisabled : {}) }}
              disabled={clampedPage >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  search: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)", minWidth: 240,
  },
  exportButton: {
    background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)",
    fontSize: 12.5, fontWeight: 600, padding: "9px 14px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  bulkBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    background: "var(--accent-soft)", border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 10,
  },
  bulkCount: { fontSize: 13, fontWeight: 700, color: "var(--accent)" },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
    userSelect: "none",
  },
  sortArrow: { color: "var(--accent)" },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  pagination: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: 12, fontSize: 12.5, color: "var(--muted)",
  },
  pageInfo: { color: "var(--muted)" },
  pageButton: {
    background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)",
    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  pageButtonDisabled: { opacity: 0.5, cursor: "not-allowed" },
};

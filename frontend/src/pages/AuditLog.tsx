import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface AuditLogRow {
  id: string;
  createdAtUtc: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string | null;
  wasDenied: boolean;
}

export default function AuditLog() {
  const [filter, setFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-log", filter],
    queryFn: async () => (await api.get<AuditLogRow[]>("/audit-log", { params: filter ? { action: filter } : {} })).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Audit Log</h1>
          <p style={s.subtitle}>Who changed what, when — approvals, denied access attempts, role remaps, and account actions. Append-only.</p>
        </div>
        <input
          style={{ ...s.input, minWidth: 220 }}
          placeholder="Filter by action, e.g. job_title"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </header>

      {isLoading && <Spinner />}
      {error && <p style={{ color: "var(--danger)" }}>Couldn't load the audit log.</p>}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>Nothing recorded yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>When</th>
                <th style={s.th}>Actor</th>
                <th style={s.th}>Action</th>
                <th style={s.th}>Entity</th>
                <th style={s.th}>Details</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td style={s.td}>{new Date(row.createdAtUtc).toLocaleString()}</td>
                  <td style={s.td}>{row.actorName ?? "—"}</td>
                  <td style={{ ...s.td, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{row.action}</td>
                  <td style={s.td}>{row.entityType}</td>
                  <td style={{ ...s.td, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--muted)", maxWidth: 320 }}>
                    {row.metadata ?? "—"}
                  </td>
                  <td style={s.td}>
                    {row.wasDenied && <span style={tag("var(--danger-soft)", "var(--danger)")}>Denied</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

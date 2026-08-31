import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

interface FnfItemRow {
  id: string;
  fnfCaseId: string;
  department: string;
  title: string;
  status: string;
  clearedAtUtc: string | null;
  notes: string | null;
}

interface FnfCaseRow {
  id: string;
  employeeId: string;
  employeeName: string;
  status: string;
  finalPayoutAmount: number | null;
  closedAtUtc: string | null;
  items: FnfItemRow[];
}

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
}

export default function FnfSettlement() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("fnf.manage");
  const [startingFor, setStartingFor] = useState("");
  const [payoutDrafts, setPayoutDrafts] = useState<Record<string, string>>({});

  const cases = useQuery({
    queryKey: ["fnf", canManage ? "all" : "mine"],
    queryFn: async () => (await api.get<FnfCaseRow[]>(canManage ? "/fnf" : "/fnf/mine")).data,
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: canManage,
  });

  const start = useMutation({
    mutationFn: (employeeId: string) => api.post("/fnf/start", { employeeId }),
    onSuccess: () => {
      setStartingFor("");
      queryClient.invalidateQueries({ queryKey: ["fnf"] });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, cleared }: { id: string; cleared: boolean }) =>
      api.patch(`/fnf/items/${id}`, { cleared }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fnf"] }),
  });

  const close = useMutation({
    mutationFn: ({ id, finalPayoutAmount }: { id: string; finalPayoutAmount: number }) =>
      api.post(`/fnf/${id}/close`, { finalPayoutAmount }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fnf"] }),
  });

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Full & Final Settlement</h1>
          <p style={styles.subtitle}>
            {canManage
              ? "Every clearance item has to be cleared before a case can be closed with a final payout."
              : "Your exit clearance status."}
          </p>
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select style={styles.select} value={startingFor} onChange={(e) => setStartingFor(e.target.value)}>
              <option value="">Initiate for…</option>
              {employees.data?.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
            <button
              style={styles.addButton}
              disabled={!startingFor || start.isPending}
              onClick={() => start.mutate(startingFor)}
            >
              Initiate settlement
            </button>
          </div>
        )}
      </header>

      {start.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(start.error as any)?.response?.data ?? "Couldn't start a case for this employee."}
        </p>
      )}

      {cases.isLoading && <Spinner />}
      {!cases.isLoading && (!cases.data || cases.data.length === 0) && (
        <p style={{ color: "var(--muted)" }}>No settlement cases in progress.</p>
      )}

      {cases.data?.map((c) => {
        const allCleared = c.items.every((i) => i.status === "Cleared");
        return (
          <section key={c.id} style={styles.section}>
            <div style={styles.caseHeader}>
              <h2 style={styles.sectionTitle}>{c.employeeName}</h2>
              {c.status === "Completed" ? (
                <span style={styles.completedTag}>
                  Settled · {c.finalPayoutAmount?.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                </span>
              ) : (
                canManage && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={styles.payoutInput}
                        type="number"
                        placeholder="Final payout"
                        disabled={!allCleared}
                        value={payoutDrafts[c.id] ?? ""}
                        onChange={(e) => setPayoutDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      />
                      <button
                        style={styles.addButton}
                        disabled={!allCleared || !payoutDrafts[c.id] || close.isPending}
                        onClick={() => close.mutate({ id: c.id, finalPayoutAmount: Number(payoutDrafts[c.id]) })}
                      >
                        {close.isPending && close.variables?.id === c.id ? "Closing…" : "Close case"}
                      </button>
                    </div>
                    {!allCleared && (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Every clearance item must be cleared first.
                      </span>
                    )}
                    {close.isError && close.variables?.id === c.id && (
                      <span style={{ fontSize: 12, color: "var(--danger)" }}>
                        {(close.error as any)?.response?.data ?? "Couldn't close this case."}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Item</th>
                    <th style={styles.th}>Department</th>
                    <th style={styles.th}>Status</th>
                    {canManage && c.status !== "Completed" && <th style={styles.th}></th>}
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>{item.title}</td>
                      <td style={styles.td}>{item.department}</td>
                      <td style={styles.td}><StatusTag status={item.status} /></td>
                      {canManage && c.status !== "Completed" && (
                        <td style={styles.td}>
                          {item.status !== "Cleared" ? (
                            <button style={styles.approve} onClick={() => updateItem.mutate({ id: item.id, cleared: true })}>
                              Mark cleared
                            </button>
                          ) : (
                            <button style={styles.secondary} onClick={() => updateItem.mutate({ id: item.id, cleared: false })}>
                              Undo
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Cleared: ["var(--good-soft)", "var(--good)"],
    Pending: ["var(--surface-sunken)", "var(--faint)"],
  };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: bg, color: fg, padding: "3px 9px", borderRadius: 20 }}>{status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 480 },
  select: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 28 },
  caseHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "var(--ink)" },
  completedTag: {
    fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--good-soft)", color: "var(--good)",
    padding: "4px 10px", borderRadius: 20, fontWeight: 700,
  },
  payoutInput: {
    width: 140, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "8px 10px", fontSize: 13, color: "var(--ink)",
  },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
  },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  secondary: {
    background: "var(--surface-sunken)", color: "var(--muted)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

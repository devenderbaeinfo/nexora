import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";

interface AccountRow { id: string; code: string; name: string; }
interface JournalLineRow { accountId: string; accountName: string; debit: number; credit: number; }
interface JournalEntryRow { id: string; entryDate: string; memo: string; postedByName: string; lines: JournalLineRow[]; }

interface DraftLine { accountId: string; debit: string; credit: string; }

export default function JournalEntries() {
  const { can } = useAuth();
  const canPost = can("accounting.post_entries");
  const queryClient = useQueryClient();

  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]);

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<AccountRow[]>("/accounting/accounts")).data,
  });

  const entries = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => (await api.get<JournalEntryRow[]>("/accounting/journal-entries")).data,
  });

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const post = useMutation({
    mutationFn: () => api.post("/accounting/journal-entries", {
      entryDate, memo,
      lines: lines.filter((l) => l.accountId).map((l) => ({
        accountId: l.accountId, debit: Number(l.debit || 0), credit: Number(l.credit || 0),
      })),
    }),
    onSuccess: () => {
      setMemo("");
      setLines([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]);
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["accounting"] });
    },
  });

  const updateLine = (i: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Journal Entries</h1>
          <p style={s.subtitle}>Posted directly — debits and credits must balance before an entry can be saved.</p>
        </div>
      </header>

      {canPost && (
        <section style={{ ...s.card, marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="date" style={s.input} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            <input style={{ ...s.input, flex: 1, minWidth: 200 }} placeholder="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <select style={{ ...s.select, flex: 1 }} value={line.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })}>
                <option value="">Select account…</option>
                {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
              <input
                type="number" style={{ ...s.input, width: 110 }} placeholder="Debit" value={line.debit}
                onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
              />
              <input
                type="number" style={{ ...s.input, width: 110 }} placeholder="Credit" value={line.credit}
                onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
              />
            </div>
          ))}

          <button style={s.secondary} onClick={() => setLines((prev) => [...prev, { accountId: "", debit: "", credit: "" }])}>
            + Add line
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <span style={{ fontSize: 13, color: balanced ? "var(--good)" : "var(--muted)" }}>
              Debit {totalDebit.toFixed(2)} / Credit {totalCredit.toFixed(2)} {balanced ? "— balanced" : ""}
            </span>
            <button style={s.addButton} disabled={!balanced || !memo.trim() || post.isPending} onClick={() => post.mutate()}>
              Post entry
            </button>
          </div>
          {post.isError && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
              {(post.error as any)?.response?.data ?? "Couldn't post this entry."}
            </p>
          )}
        </section>
      )}

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Recent entries</h2>
        {entries.data?.map((entry) => (
          <div key={entry.id} style={{ ...s.card, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{entry.memo}</span>
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{entry.entryDate} · posted by {entry.postedByName}</span>
            </div>
            <table style={s.table}>
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ ...s.td, border: "none", padding: "4px 0" }}>{l.accountName}</td>
                    <td style={{ ...s.td, border: "none", padding: "4px 0", textAlign: "right" }}>{l.debit > 0 ? l.debit.toFixed(2) : ""}</td>
                    <td style={{ ...s.td, border: "none", padding: "4px 0", textAlign: "right" }}>{l.credit > 0 ? l.credit.toFixed(2) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!entries.isLoading && (!entries.data || entries.data.length === 0) && <p style={s.muted}>No entries posted yet.</p>}
      </section>
    </div>
  );
}

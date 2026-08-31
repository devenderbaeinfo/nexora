import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";

interface AccountRow { id: string; code: string; name: string; isCashAccount: boolean; }
interface LedgerLine { journalEntryId: string; entryDate: string; memo: string; debit: number; credit: number; runningBalance: number; }

export default function GeneralLedger({ cashOnly = false }: { cashOnly?: boolean }) {
  const [accountId, setAccountId] = useState("");

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<AccountRow[]>("/accounting/accounts")).data,
  });

  const ledger = useQuery({
    queryKey: ["ledger", accountId],
    queryFn: async () => (await api.get<LedgerLine[]>(`/accounting/ledger/${accountId}`)).data,
    enabled: !!accountId,
  });

  const options = cashOnly ? accounts.data?.filter((a) => a.isCashAccount) : accounts.data;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>{cashOnly ? "Bank / Cash" : "General Ledger"}</h1>
          <p style={s.subtitle}>{cashOnly ? "Movement through cash and bank accounts." : "Every journal line posted to an account, with a running balance."}</p>
        </div>
        <select style={s.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Select account…</option>
          {options?.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </header>

      {!accountId && <p style={s.muted}>Select an account to see its ledger.</p>}

      {accountId && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Memo</th>
                <th style={s.th}>Debit</th>
                <th style={s.th}>Credit</th>
                <th style={s.th}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {(!ledger.data || ledger.data.length === 0) && (
                <tr><td style={s.td} colSpan={5}>No activity on this account yet.</td></tr>
              )}
              {ledger.data?.map((l, i) => (
                <tr key={i}>
                  <td style={s.td}>{l.entryDate}</td>
                  <td style={s.td}>{l.memo}</td>
                  <td style={s.td}>{l.debit > 0 ? l.debit.toFixed(2) : "—"}</td>
                  <td style={s.td}>{l.credit > 0 ? l.credit.toFixed(2) : "—"}</td>
                  <td style={s.td}>{l.runningBalance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  type: string;
  debit: number;
  credit: number;
}

export default function TrialBalance() {
  const { data, isLoading } = useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => (await api.get<TrialBalanceRow[]>("/accounting/trial-balance")).data,
  });

  const totalDebit = data?.reduce((sum, r) => sum + r.debit, 0) ?? 0;
  const totalCredit = data?.reduce((sum, r) => sum + r.credit, 0) ?? 0;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Trial Balance</h1>
          <p style={s.subtitle}>Every account's balance, as of now. Total debit and total credit should always match.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>No journal activity yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Code</th>
                <th style={s.th}>Account</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Debit</th>
                <th style={s.th}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.accountCode}>
                  <td style={s.td}>{r.accountCode}</td>
                  <td style={s.td}>{r.accountName}</td>
                  <td style={s.td}>{r.type}</td>
                  <td style={s.td}>{r.debit > 0 ? r.debit.toFixed(2) : "—"}</td>
                  <td style={s.td}>{r.credit > 0 ? r.credit.toFixed(2) : "—"}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...s.td, fontWeight: 700 }} colSpan={3}>Total</td>
                <td style={{ ...s.td, fontWeight: 700 }}>{totalDebit.toFixed(2)}</td>
                <td style={{ ...s.td, fontWeight: 700 }}>{totalCredit.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

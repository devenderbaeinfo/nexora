import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  isCashAccount: boolean;
  isActive: boolean;
}

const TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"];

export default function ChartOfAccounts() {
  const { can } = useAuth();
  const canPost = can("accounting.post_entries");
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Asset");
  const [isCashAccount, setIsCashAccount] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<AccountRow[]>("/accounting/accounts")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/accounting/accounts", { code, name, type, isCashAccount }),
    onSuccess: () => {
      setCode(""); setName(""); setType("Asset"); setIsCashAccount(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Chart of Accounts</h1>
          <p style={s.subtitle}>Every account journal entries can post to.</p>
        </div>
      </header>

      {canPost && (
        <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...s.input, width: 100 }} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <input style={{ ...s.input, minWidth: 200 }} placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} />
          <select style={s.select} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
            <input type="checkbox" checked={isCashAccount} onChange={(e) => setIsCashAccount(e.target.checked)} />
            Cash/bank account
          </label>
          <button style={s.addButton} disabled={!code.trim() || !name.trim() || create.isPending} onClick={() => create.mutate()}>
            Add account
          </button>
        </section>
      )}

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this account."}
        </p>
      )}

      {isLoading && <Spinner />}

      {data && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Code</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Cash?</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td style={s.td}>{a.code}</td>
                  <td style={s.td}>{a.name}</td>
                  <td style={s.td}>{a.type}</td>
                  <td style={s.td}>{a.isCashAccount && <span style={tag("var(--teal-soft)", "var(--teal)")}>Cash</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

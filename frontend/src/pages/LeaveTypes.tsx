import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";

interface LeaveTypeRow {
  id: string;
  name: string;
  annualAllowance: number;
  allowsHalfDay: boolean;
  selfCertificationLimitDays: number;
}

export default function LeaveTypes() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [annualAllowance, setAnnualAllowance] = useState(12);
  const [allowsHalfDay, setAllowsHalfDay] = useState(true);
  const [selfCertLimit, setSelfCertLimit] = useState(2);

  const leaveTypes = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: async () => (await api.get<LeaveTypeRow[]>("/leave-types")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/leave-types", {
      name, annualAllowance, allowsHalfDay, selfCertificationLimitDays: selfCertLimit,
    }),
    onSuccess: () => {
      setName(""); setAnnualAllowance(12); setAllowsHalfDay(true); setSelfCertLimit(2);
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
    },
  });

  const update = useMutation({
    mutationFn: (row: LeaveTypeRow) => api.patch(`/leave-types/${row.id}`, {
      name: row.name, annualAllowance: row.annualAllowance,
      allowsHalfDay: row.allowsHalfDay, selfCertificationLimitDays: row.selfCertificationLimitDays,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leaveTypes"] }),
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Leave Types</h1>
          <p style={s.subtitle}>The kinds of leave your company offers. The annual allowance here is just the default new hires start from — "Manage leave" on People can give any individual employee more or less.</p>
        </div>
      </header>

      <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...s.input, minWidth: 180 }} placeholder="Name, e.g. Sick Leave" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          type="number" min={0} step={0.5} style={{ ...s.input, width: 100 }}
          placeholder="Days/yr" value={annualAllowance} onChange={(e) => setAnnualAllowance(Number(e.target.value))}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={allowsHalfDay} onChange={(e) => setAllowsHalfDay(e.target.checked)} />
          Allows half-day
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          Self-certify up to
          <input
            type="number" min={0} style={{ ...s.input, width: 70 }}
            value={selfCertLimit} onChange={(e) => setSelfCertLimit(Number(e.target.value))}
          />
          days
        </label>
        <button style={s.addButton} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          Add leave type
        </button>
      </section>

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this leave type."}
        </p>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Default days/yr</th>
              <th style={s.th}>Half-day</th>
              <th style={s.th}>Self-certify limit</th>
            </tr>
          </thead>
          <tbody>
            {(!leaveTypes.data || leaveTypes.data.length === 0) && (
              <tr><td style={s.td} colSpan={4}>No leave types yet — add one above.</td></tr>
            )}
            {leaveTypes.data?.map((t) => (
              <tr key={t.id}>
                <td style={s.td}>{t.name}</td>
                <td style={s.td}>
                  <input
                    type="number" min={0} step={0.5} style={{ ...s.input, width: 90 }}
                    defaultValue={t.annualAllowance}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (value !== t.annualAllowance) update.mutate({ ...t, annualAllowance: value });
                    }}
                  />
                </td>
                <td style={s.td}>
                  <input type="checkbox" checked={t.allowsHalfDay} onChange={(e) => update.mutate({ ...t, allowsHalfDay: e.target.checked })} />
                </td>
                <td style={s.td}>
                  <input
                    type="number" min={0} style={{ ...s.input, width: 70 }}
                    defaultValue={t.selfCertificationLimitDays}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (value !== t.selfCertificationLimitDays) update.mutate({ ...t, selfCertificationLimitDays: value });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

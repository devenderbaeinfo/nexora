import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface LeadRow {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  estimatedValue: number;
  stage: string;
}

const STAGE_COLORS: Record<string, [string, string]> = {
  New: ["var(--surface-sunken)", "var(--muted)"],
  Contacted: ["var(--info-soft)", "var(--info)"],
  Qualified: ["var(--gold-soft)", "var(--gold)"],
  Won: ["var(--good-soft)", "var(--good)"],
  Lost: ["var(--danger-soft)", "var(--danger)"],
};

export default function Leads() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");

  const leads = useQuery({
    queryKey: ["sales", "leads"],
    queryFn: async () => (await api.get<LeadRow[]>("/sales/leads")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/sales/leads", {
      companyName, contactName, contactEmail, estimatedValue: Number(estimatedValue) || 0,
    }),
    onSuccess: () => {
      setCompanyName(""); setContactName(""); setContactEmail(""); setEstimatedValue("");
      queryClient.invalidateQueries({ queryKey: ["sales", "leads"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Leads</h1>
          <p style={s.subtitle}>Prospective deals, from first contact to close.</p>
        </div>
      </header>

      {can("sales.manage") && (
        <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...s.input, minWidth: 180 }} placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <input style={{ ...s.input, minWidth: 160 }} placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <input style={{ ...s.input, minWidth: 200 }} placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <input style={{ ...s.input, width: 140 }} type="number" min={0} placeholder="Est. value" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
          <button
            style={s.addButton}
            disabled={!companyName.trim() || !contactName.trim() || !contactEmail.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Add lead
          </button>
        </section>
      )}

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this lead."}
        </p>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Company</th>
              <th style={s.th}>Contact</th>
              <th style={s.th}>Est. value</th>
              <th style={s.th}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {leads.data?.map((l) => {
              const [bg, fg] = STAGE_COLORS[l.stage] ?? STAGE_COLORS.New;
              return (
                <tr key={l.id}>
                  <td style={s.td}>{l.companyName}</td>
                  <td style={s.td}>
                    <div>{l.contactName}</div>
                    <div style={{ color: "var(--faint)", fontSize: 12.5 }}>{l.contactEmail}</div>
                  </td>
                  <td style={s.td}>{formatCurrency(l.estimatedValue)}</td>
                  <td style={s.td}><span style={tag(bg, fg)}>{l.stage}</span></td>
                </tr>
              );
            })}
            {leads.data?.length === 0 && (
              <tr><td style={s.td} colSpan={4}>No leads yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

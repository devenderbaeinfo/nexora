import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";

interface ContactRow {
  id: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string | null;
  type: string;
}

const TYPE_COLORS: Record<string, [string, string]> = {
  Customer: ["var(--good-soft)", "var(--good)"],
  Prospect: ["var(--info-soft)", "var(--info)"],
  Partner: ["var(--gold-soft)", "var(--gold)"],
};

export default function Contacts() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("Prospect");

  const contacts = useQuery({
    queryKey: ["crm", "contacts"],
    queryFn: async () => (await api.get<ContactRow[]>("/crm/contacts")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/crm/contacts", { fullName, companyName, email, phone: phone || null, type }),
    onSuccess: () => {
      setFullName(""); setCompanyName(""); setEmail(""); setPhone("");
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Contacts</h1>
          <p style={s.subtitle}>Every customer, prospect, and partner, in one place.</p>
        </div>
      </header>

      {can("crm.manage") && (
        <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...s.input, minWidth: 160 }} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input style={{ ...s.input, minWidth: 160 }} placeholder="Company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <input style={{ ...s.input, minWidth: 200 }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={{ ...s.input, width: 150 }} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select style={s.select} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Prospect">Prospect</option>
            <option value="Customer">Customer</option>
            <option value="Partner">Partner</option>
          </select>
          <button
            style={s.addButton}
            disabled={!fullName.trim() || !email.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Add contact
          </button>
        </section>
      )}

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this contact."}
        </p>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Company</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Type</th>
            </tr>
          </thead>
          <tbody>
            {contacts.data?.map((c) => {
              const [bg, fg] = TYPE_COLORS[c.type] ?? TYPE_COLORS.Prospect;
              return (
                <tr key={c.id}>
                  <td style={s.td}>{c.fullName}</td>
                  <td style={s.td}>{c.companyName}</td>
                  <td style={s.td}>
                    <div>{c.email}</div>
                    {c.phone && <div style={{ color: "var(--faint)", fontSize: 12.5 }}>{c.phone}</div>}
                  </td>
                  <td style={s.td}><span style={tag(bg, fg)}>{c.type}</span></td>
                </tr>
              );
            })}
            {contacts.data?.length === 0 && (
              <tr><td style={s.td} colSpan={4}>No contacts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

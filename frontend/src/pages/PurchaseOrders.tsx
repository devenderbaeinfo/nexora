import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface PurchaseOrderRow {
  id: string;
  vendorName: string;
  description: string;
  amount: number;
  status: string;
  orderDate: string;
}

const STATUS_COLORS: Record<string, [string, string]> = {
  Draft: ["var(--surface-sunken)", "var(--muted)"],
  Submitted: ["var(--info-soft)", "var(--info)"],
  Approved: ["var(--gold-soft)", "var(--gold)"],
  Received: ["var(--good-soft)", "var(--good)"],
};

export default function PurchaseOrders() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));

  const orders = useQuery({
    queryKey: ["procurement", "purchase-orders"],
    queryFn: async () => (await api.get<PurchaseOrderRow[]>("/procurement/purchase-orders")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/procurement/purchase-orders", {
      vendorName, description, amount: Number(amount) || 0, orderDate,
    }),
    onSuccess: () => {
      setVendorName(""); setDescription(""); setAmount("");
      queryClient.invalidateQueries({ queryKey: ["procurement", "purchase-orders"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Purchase Orders</h1>
          <p style={s.subtitle}>What's on order from every vendor, and where it stands.</p>
        </div>
      </header>

      {can("procurement.manage") && (
        <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...s.input, minWidth: 180 }} placeholder="Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          <input style={{ ...s.input, minWidth: 220 }} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input style={{ ...s.input, width: 140 }} type="number" min={0} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input style={s.input} type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          <button
            style={s.addButton}
            disabled={!vendorName.trim() || !description.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Add purchase order
          </button>
        </section>
      )}

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this purchase order."}
        </p>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Vendor</th>
              <th style={s.th}>Description</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Order date</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.data?.map((o) => {
              const [bg, fg] = STATUS_COLORS[o.status] ?? STATUS_COLORS.Draft;
              return (
                <tr key={o.id}>
                  <td style={s.td}>{o.vendorName}</td>
                  <td style={s.td}>{o.description}</td>
                  <td style={s.td}>{formatCurrency(o.amount)}</td>
                  <td style={s.td}>{o.orderDate}</td>
                  <td style={s.td}><span style={tag(bg, fg)}>{o.status}</span></td>
                </tr>
              );
            })}
            {orders.data?.length === 0 && (
              <tr><td style={s.td} colSpan={5}>No purchase orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

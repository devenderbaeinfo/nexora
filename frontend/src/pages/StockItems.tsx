import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface StockItemRow {
  id: string;
  sku: string;
  name: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitPrice: number;
}

export default function StockItems() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [quantityOnHand, setQuantityOnHand] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const items = useQuery({
    queryKey: ["inventory", "stock-items"],
    queryFn: async () => (await api.get<StockItemRow[]>("/inventory/stock-items")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/inventory/stock-items", {
      sku, name, quantityOnHand: Number(quantityOnHand) || 0,
      reorderLevel: Number(reorderLevel) || 0, unitPrice: Number(unitPrice) || 0,
    }),
    onSuccess: () => {
      setSku(""); setName(""); setQuantityOnHand(""); setReorderLevel(""); setUnitPrice("");
      queryClient.invalidateQueries({ queryKey: ["inventory", "stock-items"] });
    },
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Stock Items</h1>
          <p style={s.subtitle}>What's on hand, and what's running low.</p>
        </div>
      </header>

      {can("inventory.manage") && (
        <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...s.input, width: 140 }} placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <input style={{ ...s.input, minWidth: 200 }} placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={{ ...s.input, width: 130 }} type="number" min={0} placeholder="Qty on hand" value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} />
          <input style={{ ...s.input, width: 130 }} type="number" min={0} placeholder="Reorder level" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
          <input style={{ ...s.input, width: 120 }} type="number" min={0} placeholder="Unit price" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          <button
            style={s.addButton}
            disabled={!sku.trim() || !name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Add stock item
          </button>
        </section>
      )}

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this stock item."}
        </p>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>SKU</th>
              <th style={s.th}>Name</th>
              <th style={s.th}>Qty on hand</th>
              <th style={s.th}>Unit price</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {items.data?.map((i) => {
              const low = i.quantityOnHand <= i.reorderLevel;
              return (
                <tr key={i.id}>
                  <td style={{ ...s.td, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{i.sku}</td>
                  <td style={s.td}>{i.name}</td>
                  <td style={s.td}>{i.quantityOnHand}</td>
                  <td style={s.td}>{formatCurrency(i.unitPrice)}</td>
                  <td style={s.td}>
                    {low && <span style={tag("var(--danger-soft)", "var(--danger)")}>Low stock</span>}
                  </td>
                </tr>
              );
            })}
            {items.data?.length === 0 && (
              <tr><td style={s.td} colSpan={5}>No stock items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

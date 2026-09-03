import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s, tag } from "../styles/pageKit";
import { formStyles } from "../components/formStyles";
import DataTable, { type DataTableColumn } from "../components/DataTable";
import Drawer from "../components/Drawer";
import { formatCurrency } from "../lib/currency";

interface Vendor { id: string; name: string; contactEmail: string | null; contactPhone: string | null; isActive: boolean; }
interface VendorBill {
  id: string; vendorId: string; vendorName: string; billNumber: string;
  billDate: string; dueDate: string; category: string; amount: number; status: string;
  journalEntryId: string | null; rejectionReason: string | null;
  paidAtUtc: string | null; paymentJournalEntryId: string | null;
}

const currency = formatCurrency;

function statusTag(status: string) {
  const colors: Record<string, [string, string]> = {
    Pending: ["var(--warn-soft)", "var(--warn)"],
    Approved: ["var(--accent-soft)", "var(--accent)"],
    Paid: ["var(--good-soft)", "var(--good)"],
    Rejected: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, fg] = colors[status] ?? ["var(--surface-sunken)", "var(--faint)"];
  return <span style={tag(bg, fg)}>{status}</span>;
}

export default function VendorBills() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [vendorDrawerOpen, setVendorDrawerOpen] = useState(false);
  const [billDrawerOpen, setBillDrawerOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const vendors = useQuery({
    queryKey: ["vendor-bills", "vendors"],
    queryFn: async () => (await api.get<Vendor[]>("/vendor-bills/vendors")).data,
  });
  const bills = useQuery({
    queryKey: ["vendor-bills", "bills"],
    queryFn: async () => (await api.get<VendorBill[]>("/vendor-bills/bills")).data,
  });

  const invalidateBills = () => queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/vendor-bills/bills/${id}/approve`),
    onSuccess: invalidateBills,
  });
  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/vendor-bills/bills/${id}/pay`),
    onSuccess: invalidateBills,
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/vendor-bills/bills/${id}/reject`, { reason }),
    onSuccess: () => { invalidateBills(); setRejectingId(null); setRejectReason(""); },
  });

  const canApprove = can("accounts_payable.approve");
  const today = new Date().toISOString().slice(0, 10);

  const columns: DataTableColumn<VendorBill>[] = [
    { key: "vendor", header: "Vendor", value: (b) => b.vendorName, render: (b) => b.vendorName },
    { key: "billNumber", header: "Bill #", value: (b) => b.billNumber, render: (b) => b.billNumber },
    { key: "category", header: "Category", value: (b) => b.category, render: (b) => b.category },
    { key: "amount", header: "Amount", value: (b) => b.amount, render: (b) => currency(b.amount) },
    {
      key: "dueDate", header: "Due", value: (b) => b.dueDate,
      render: (b) => (
        <span style={{ color: b.status === "Pending" && b.dueDate < today ? "var(--danger)" : undefined }}>
          {b.dueDate}{b.status === "Pending" && b.dueDate < today ? " (overdue)" : ""}
        </span>
      ),
    },
    { key: "status", header: "Status", value: (b) => b.status, render: (b) => statusTag(b.status) },
    {
      key: "actions", header: "", render: (b) => (
        <div style={{ display: "flex", gap: 8 }}>
          {canApprove && b.status === "Pending" && (
            <>
              <button style={s.approve} onClick={() => approve.mutate(b.id)}>Approve</button>
              <button style={s.reject} onClick={() => setRejectingId(b.id)}>Reject</button>
            </>
          )}
          {canApprove && b.status === "Approved" && (
            <button style={s.approve} onClick={() => pay.mutate(b.id)}>Record payment</button>
          )}
          {b.status === "Rejected" && b.rejectionReason && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{b.rejectionReason}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Vendor Bills</h1>
          <p style={s.subtitle}>Accounts Payable — vendors, bills awaiting approval, and payments.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={s.secondary} onClick={() => setVendorDrawerOpen(true)}>New vendor</button>
          {can("accounts_payable.manage") && (
            <button style={s.addButton} onClick={() => setBillDrawerOpen(true)}>Submit bill</button>
          )}
        </div>
      </header>

      <DataTable
        columns={columns}
        rows={bills.data ?? []}
        rowKey={(b) => b.id}
        isLoading={bills.isLoading}
        error={bills.error}
        errorMessage="Couldn't load vendor bills."
        emptyMessage="No vendor bills yet."
        searchPlaceholder="Search bills…"
      />

      <Drawer open={vendorDrawerOpen} title="New vendor" onClose={() => setVendorDrawerOpen(false)}>
        <NewVendorForm onDone={() => { setVendorDrawerOpen(false); queryClient.invalidateQueries({ queryKey: ["vendor-bills", "vendors"] }); }} />
      </Drawer>

      <Drawer open={billDrawerOpen} title="Submit vendor bill" onClose={() => setBillDrawerOpen(false)}>
        <NewBillForm vendors={vendors.data ?? []} onDone={() => { setBillDrawerOpen(false); invalidateBills(); }} />
      </Drawer>

      <Drawer open={rejectingId !== null} title="Reject bill" onClose={() => setRejectingId(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={formStyles.label}>Reason</label>
          <textarea style={{ ...s.input, minHeight: 80 }} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          {reject.isError && <p style={{ color: "var(--danger)", fontSize: 13 }}>Couldn't reject this bill.</p>}
          <button
            style={s.addButton} disabled={!rejectReason.trim() || reject.isPending}
            onClick={() => rejectingId && reject.mutate({ id: rejectingId, reason: rejectReason.trim() })}
          >
            Reject bill
          </button>
        </div>
      </Drawer>
    </div>
  );
}

function NewVendorForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/vendor-bills/vendors", { name, contactEmail: contactEmail || null, contactPhone: contactPhone || null }),
    onSuccess: onDone,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input style={s.input} placeholder="Vendor name" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={s.input} placeholder="Contact email (optional)" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      <input style={s.input} placeholder="Contact phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      {create.isError && <p style={{ color: "var(--danger)", fontSize: 13 }}>Couldn't create this vendor.</p>}
      <button style={s.addButton} disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>Create vendor</button>
    </div>
  );
}

function NewBillForm({ vendors, onDone }: { vendors: Vendor[]; onDone: () => void }) {
  const [vendorId, setVendorId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  const submit = useMutation({
    mutationFn: () => api.post("/vendor-bills/bills", {
      vendorId, billNumber, billDate, dueDate, category, amount: Number(amount),
    }),
    onSuccess: onDone,
  });

  const valid = vendorId && billNumber.trim() && category.trim() && Number(amount) > 0 && dueDate >= billDate;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <select style={s.select} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
        <option value="">— Select a vendor —</option>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <input style={s.input} placeholder="Bill number" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
      <input style={s.input} placeholder="Category (e.g. Office Supplies)" value={category} onChange={(e) => setCategory(e.target.value)} />
      <input style={s.input} type="number" min={0} step={0.01} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Bill date</label>
          <input style={s.input} type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "var(--muted)" }}>Due date</label>
          <input style={s.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      {submit.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13 }}>
          {(submit.error as any)?.response?.data ?? "Couldn't submit this bill."}
        </p>
      )}
      <button style={s.addButton} disabled={!valid || submit.isPending} onClick={() => submit.mutate()}>Submit bill</button>
    </div>
  );
}

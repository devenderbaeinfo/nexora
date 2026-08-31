import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";

interface Customer { id: string; name: string; }
interface Employee { id: string; firstName: string; lastName: string; }

export default function NewProjectForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get<Customer[]>("/customers")).data,
  });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<Employee[]>("/employees")).data,
  });

  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [budgetAmount, setBudgetAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId && newCustomerName.trim()) {
        const { data } = await api.post("/customers", { name: newCustomerName.trim() });
        resolvedCustomerId = data.id;
      }
      return api.post("/projects", {
        name, customerId: resolvedCustomerId, projectManagerId, startDate,
        budgetAmount: Number(budgetAmount || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onDone();
    },
    onError: (err: any) => {
      setError(err?.response?.data ?? "Couldn't create this project. Check the fields and try again.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerId && !newCustomerName.trim()) {
      setError("Pick an existing customer or name a new one.");
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit}>
      <label style={s.label} htmlFor="name">Project name</label>
      <input id="name" style={s.field} value={name} onChange={(e) => setName(e.target.value)} required />

      <label style={s.label} htmlFor="customer">Customer</label>
      <select
        id="customer" style={s.field} value={customerId}
        onChange={(e) => { setCustomerId(e.target.value); if (e.target.value) setNewCustomerName(""); }}
      >
        <option value="">— New customer —</option>
        {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {!customerId && (
        <>
          <label style={s.label} htmlFor="newCustomer">New customer name</label>
          <input id="newCustomer" style={s.field} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
        </>
      )}

      <label style={s.label} htmlFor="pm">Project manager</label>
      <select id="pm" style={s.field} value={projectManagerId} onChange={(e) => setProjectManagerId(e.target.value)} required>
        <option value="" disabled>Select a project manager</option>
        {employees?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
      </select>

      <label style={s.label} htmlFor="startDate">Start date</label>
      <input id="startDate" type="date" style={s.field} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />

      <label style={s.label} htmlFor="budget">Budget</label>
      <input id="budget" type="number" min="0" step="0.01" style={s.field} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";

const CATEGORIES = ["Travel", "Meals", "Software", "Office Supplies", "Other"];

export default function SubmitReimbursementForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [incurredOn, setIncurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/reimbursements", {
      amount: Number(amount), category, description, incurredOn,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
      onDone();
    },
    onError: (err: any) => {
      setError(err?.response?.data ?? "Couldn't submit this expense. Check the fields and try again.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit}>
      <label style={s.label} htmlFor="category">Category</label>
      <select id="category" style={s.field} value={category} onChange={(e) => setCategory(e.target.value)} required>
        <option value="" disabled>Select a category</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <label style={s.label} htmlFor="amount">Amount</label>
      <input id="amount" type="number" min="0.01" step="0.01" style={s.field} value={amount} onChange={(e) => setAmount(e.target.value)} required />

      <label style={s.label} htmlFor="incurredOn">Date incurred</label>
      <input id="incurredOn" type="date" style={s.field} value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} required />

      <label style={s.label} htmlFor="description">Description</label>
      <textarea
        id="description"
        style={{ ...s.field, minHeight: 80, resize: "vertical" }}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting…" : "Submit expense"}
        </button>
      </div>
    </form>
  );
}

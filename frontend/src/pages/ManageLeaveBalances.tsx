import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";
import Spinner from "../components/Spinner";

interface EmployeeLeaveBalance { leaveTypeId: string; leaveTypeName: string; allotted: number; used: number; remaining: number; }

// HR's per-person leave editor — opened from the People table, this is what lets HR change
// an existing employee's leave types and day counts after they've already been created,
// not just at hire time.
export default function ManageLeaveBalances({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["leave-balances", employeeId],
    queryFn: async () => (await api.get<EmployeeLeaveBalance[]>(`/leave-requests/balances/${employeeId}`)).data,
  });

  const [days, setDays] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!data) return;
    setDays(Object.fromEntries(data.map((b) => [b.leaveTypeId, b.allotted])));
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put(`/leave-requests/balances/${employeeId}`, (data ?? []).map((b) => ({
      leaveTypeId: b.leaveTypeId, allotted: days[b.leaveTypeId] ?? b.allotted,
    }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances", employeeId] });
      onDone();
    },
  });

  const errorMessage = save.isError
    ? ((save.error as any)?.response?.data ?? "Couldn't save these allotments. Try again.")
    : null;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {data?.map((b) => (
          <div key={b.leaveTypeId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{b.leaveTypeName}</span>
            <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{b.used} used</span>
            <input
              type="number" min={0} step={0.5}
              style={{ ...s.field, width: 80, marginBottom: 0 }}
              value={days[b.leaveTypeId] ?? b.allotted}
              onChange={(e) => setDays((prev) => ({ ...prev, [b.leaveTypeId]: Number(e.target.value) }))}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>days</span>
          </div>
        ))}
        {data?.length === 0 && <p style={{ fontSize: 13.5, color: "var(--muted)" }}>No leave types configured yet.</p>}
      </div>

      {errorMessage && <div style={s.error} role="alert">{String(errorMessage)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="button" style={s.button} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save allotments"}
        </button>
      </div>
    </div>
  );
}

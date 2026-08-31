import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";

interface EmployeeOption { id: string; firstName: string; lastName: string; jobTitleName: string; }

// Backfills or changes an existing employee's reporting manager — without one, their leave/
// timesheet/expense requests have no manager queue to ever land in, so this isn't just an
// org-chart nicety.
export default function SetManagerForm({
  employeeId, currentManagerId, onDone,
}: { employeeId: string; currentManagerId: string | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [managerId, setManagerId] = useState(currentManagerId ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeOption[]>("/employees")).data,
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/employees/${employeeId}/manager`, { reportingManagerId: managerId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onDone();
    },
    onError: (err: any) => setError(err?.response?.data ?? "Couldn't set the manager."),
  });

  return (
    <div>
      <label style={s.label} htmlFor="manager">Reporting manager</label>
      <select id="manager" style={s.field} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
        <option value="">No manager</option>
        {employees?.filter((e) => e.id !== employeeId).map((e) => (
          <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.jobTitleName}</option>
        ))}
      </select>

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="button" style={s.button} disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

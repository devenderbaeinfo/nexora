import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";

interface LeaveType { id: string; name: string; allowsHalfDay: boolean; selfCertificationLimitDays: number; }

export default function SubmitLeaveForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: leaveTypes } = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: async () => (await api.get<LeaveType[]>("/leave-types")).data,
  });

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [half, setHalf] = useState<"None" | "First" | "Second">("None");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedType = leaveTypes?.find((t) => t.id === leaveTypeId);

  const mutation = useMutation({
    mutationFn: () => api.post("/leave-requests", {
      leaveTypeId,
      startDate,
      endDate: half === "None" ? endDate : startDate,
      half,
      reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests", "mine"] });
      onDone();
    },
    onError: (err: any) => {
      setError(err?.response?.data ?? "Couldn't submit this request. Check the fields and try again.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <form onSubmit={onSubmit}>
      <label style={s.label} htmlFor="leaveType">Leave type</label>
      <select id="leaveType" style={s.field} value={leaveTypeId} onChange={(e) => { setLeaveTypeId(e.target.value); setHalf("None"); }} required>
        <option value="" disabled>Select a leave type</option>
        {leaveTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      <label style={s.label} htmlFor="startDate">Start date</label>
      <input id="startDate" type="date" style={s.field} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />

      {half === "None" && (
        <>
          <label style={s.label} htmlFor="endDate">End date</label>
          <input id="endDate" type="date" style={s.field} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </>
      )}

      {selectedType?.allowsHalfDay && (
        <>
          <label style={s.label} htmlFor="half">Half-day</label>
          <select id="half" style={s.field} value={half} onChange={(e) => setHalf(e.target.value as any)}>
            <option value="None">Full day(s)</option>
            <option value="First">First half</option>
            <option value="Second">Second half</option>
          </select>
        </>
      )}

      <label style={s.label} htmlFor="reason">Reason</label>
      <textarea
        id="reason"
        style={{ ...s.field, minHeight: 80, resize: "vertical" }}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      {selectedType && selectedType.selfCertificationLimitDays > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: -8, marginBottom: 16 }}>
          A medical certificate will be required if this exceeds {selectedType.selfCertificationLimitDays} consecutive day(s).
        </p>
      )}

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

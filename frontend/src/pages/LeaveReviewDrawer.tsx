import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";
import Spinner from "../components/Spinner";

interface LeaveRequestRow {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: string;
  reason: string | null;
  managerApprovalStatus: string;
  managerActedByName: string | null;
  managerActedAtUtc: string | null;
  managerComment: string | null;
}

interface LeaveHistoryItem { leaveTypeName: string; startDate: string; endDate: string; daysRequested: number; status: string; }
interface LeaveReviewContext {
  employeeName: string; departmentName: string; leaveTypeName: string;
  allotted: number; used: number; remaining: number;
  previousRequests: LeaveHistoryItem[];
}

// The Manager and HR "Review" screen: employee info, leave balance, previous history, and —
// for HR — the manager's own decision, since HR reviews on top of an approval that already
// happened, not from scratch. A comment is required to reject (mandatory for HR per policy;
// invited for everyone else) and optional to approve.
export default function LeaveReviewDrawer({
  request, stage, onDone,
}: { request: LeaveRequestRow; stage: "manager" | "hr"; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: context, isLoading } = useQuery({
    queryKey: ["leave-context", request.id],
    queryFn: async () => (await api.get<LeaveReviewContext>(`/leave-requests/${request.id}/context`)).data,
  });

  const decide = useMutation({
    mutationFn: (approve: boolean) => api.post(`/leave-requests/${request.id}/decision`, { approve, note: comment || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests"] });
      onDone();
    },
    onError: (err: any) => setError(err?.response?.data ?? "Couldn't record this decision."),
  });

  const onDecide = (approve: boolean) => {
    setError(null);
    if (!approve && stage === "hr" && !comment.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    decide.mutate(approve);
  };

  if (isLoading) return <Spinner />;

  return (
    <div>
      <section style={{ marginBottom: 20 }}>
        <h3 style={sectionTitle}>Employee</h3>
        <p style={line}>{request.employeeName} — {context?.departmentName ?? "—"}</p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3 style={sectionTitle}>Leave information</h3>
        <p style={line}>{request.leaveTypeName} · {request.startDate === request.endDate ? request.startDate : `${request.startDate} → ${request.endDate}`} · {request.daysRequested} day(s)</p>
        {request.reason && <p style={{ ...line, color: "var(--muted)" }}>"{request.reason}"</p>}
      </section>

      {context && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={sectionTitle}>Leave balance</h3>
          <p style={line}>{context.remaining} remaining / {context.allotted} allotted ({context.used} used this year)</p>
        </section>
      )}

      {stage === "hr" && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={sectionTitle}>Manager decision</h3>
          <p style={line}>
            {request.managerApprovalStatus === "Approved" ? "✓ Approved" : request.managerApprovalStatus} by {request.managerActedByName ?? "—"}
            {request.managerActedAtUtc && ` · ${new Date(request.managerActedAtUtc).toLocaleString()}`}
          </p>
          {request.managerComment && <p style={{ ...line, color: "var(--muted)" }}>"{request.managerComment}"</p>}
        </section>
      )}

      {context && context.previousRequests.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h3 style={sectionTitle}>Previous leave history</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {context.previousRequests.map((h, i) => (
              <div key={i} style={{ ...line, display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>{h.leaveTypeName} · {h.startDate === h.endDate ? h.startDate : `${h.startDate} → ${h.endDate}`}</span>
                <span style={{ color: "var(--faint)" }}>{h.daysRequested}d · {h.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <label style={s.label} htmlFor="comment">{stage === "hr" ? "HR comment" : "Manager comment"}</label>
      <textarea
        id="comment" style={{ ...s.field, minHeight: 70, resize: "vertical" }}
        placeholder={stage === "hr" ? "Required if rejecting…" : "Optional…"}
        value={comment} onChange={(e) => setComment(e.target.value)}
      />

      {error && <div style={s.error} role="alert">{error}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="button" style={{ ...s.button, background: "var(--danger)" }} disabled={decide.isPending} onClick={() => onDecide(false)}>
          Reject
        </button>
        <button type="button" style={s.button} disabled={decide.isPending} onClick={() => onDecide(true)}>
          {stage === "hr" ? "Final Approve" : "Approve"}
        </button>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--faint)", marginBottom: 6 };
const line: React.CSSProperties = { fontSize: 13.5, color: "var(--ink)", margin: "2px 0" };

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";
import BulkActionBar from "../components/BulkActionBar";
import { useBulkDecision } from "../hooks/useBulkDecision";

interface TimesheetRow {
  id: string;
  employeeName: string;
  projectName: string;
  workDate: string;
  hours: number;
  isBillable: boolean;
  notes: string | null;
  status: string;
}

export default function TimesheetApproval() {
  const queryClient = useQueryClient();
  const pending = useQuery({
    queryKey: ["timesheets", "pending"],
    queryFn: async () => (await api.get<TimesheetRow[]>("/timesheets/pending-approval")).data,
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api.post(`/timesheets/${id}/decision`, { approve }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timesheets"] }),
  });

  const { selected, toggle, toggleAll, bulkDecide } = useBulkDecision("/timesheets", ["timesheets"]);
  const ids = pending.data?.map((t) => t.id) ?? [];

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Timesheet Approval</h1>
          <p style={s.subtitle}>Hours your direct reports logged against projects, waiting on your sign-off.</p>
        </div>
      </header>

      {pending.isLoading && <Spinner />}
      {!pending.isLoading && (!pending.data || pending.data.length === 0) && (
        <p style={s.muted}>Nothing waiting on you.</p>
      )}

      {pending.data && pending.data.length > 0 && (
        <>
          <BulkActionBar
            count={selected.size}
            pending={bulkDecide.isPending}
            onApprove={() => bulkDecide.mutate({ approve: true })}
            onReject={() => bulkDecide.mutate({ approve: false })}
          />
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>
                    <input type="checkbox" checked={ids.length > 0 && ids.every((id) => selected.has(id))} onChange={() => toggleAll(ids)} />
                  </th>
                  <th style={s.th}>Employee</th>
                  <th style={s.th}>Project</th>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Hours</th>
                  <th style={s.th}>Billable</th>
                  <th style={s.th}>Notes</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {pending.data.map((t) => (
                  <tr key={t.id}>
                    <td style={s.td}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    </td>
                    <td style={s.td}>{t.employeeName}</td>
                    <td style={s.td}>{t.projectName}</td>
                    <td style={s.td}>{t.workDate}</td>
                    <td style={s.td}>{t.hours}</td>
                    <td style={s.td}>
                      <span style={tag(t.isBillable ? "var(--good-soft)" : "var(--surface-sunken)", t.isBillable ? "var(--good)" : "var(--faint)")}>
                        {t.isBillable ? "Billable" : "Non-billable"}
                      </span>
                    </td>
                    <td style={s.td}>{t.notes ?? "—"}</td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={s.approve} onClick={() => decide.mutate({ id: t.id, approve: true })}>Approve</button>
                        <button style={s.reject} onClick={() => decide.mutate({ id: t.id, approve: false })}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

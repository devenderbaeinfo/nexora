import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  clockIn: string;
  clockOut: string | null;
  regularHours: number | null;
  overtimeHours: number | null;
}

export default function Attendance({ personalOnly = false }: { personalOnly?: boolean }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canViewAll = !personalOnly && can("attendance.view_all");
  const canViewTeam = !personalOnly && !canViewAll && can("attendance.view_team");
  const canCorrect = can("attendance.correct");

  const mine = useQuery({
    queryKey: ["attendance", "mine"],
    queryFn: async () => (await api.get<AttendanceRow[]>("/attendance/mine")).data,
  });

  const today = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => (await api.get<AttendanceRow[]>("/attendance")).data,
    enabled: canViewAll,
  });

  const team = useQuery({
    queryKey: ["attendance", "team"],
    queryFn: async () => (await api.get<AttendanceRow[]>("/attendance/team")).data,
    enabled: canViewTeam,
  });

  const clockIn = useMutation({
    mutationFn: () => api.post("/attendance/clock-in"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const clockOut = useMutation({
    mutationFn: () => api.post("/attendance/clock-out"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const myToday = mine.data?.find((r) => r.workDate === todayIso);

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Attendance</h1>
          <p style={styles.subtitle}>Clock in when you start, clock out when you're done.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!myToday && (
            <button style={styles.addButton} disabled={clockIn.isPending} onClick={() => clockIn.mutate()}>
              Clock in
            </button>
          )}
          {myToday && !myToday.clockOut && (
            <button style={styles.addButton} disabled={clockOut.isPending} onClick={() => clockOut.mutate()}>
              Clock out
            </button>
          )}
          {myToday?.clockOut && <span style={{ color: "var(--good)", fontSize: 13, fontWeight: 600, alignSelf: "center" }}>Done for today</span>}
        </div>
      </header>

      {(clockIn.isError || clockOut.isError) && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {((clockIn.error ?? clockOut.error) as any)?.response?.data ?? "Something went wrong."}
        </p>
      )}

      {canViewAll && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Today, company-wide</h2>
          <AttendanceTable rows={today.data} isLoading={today.isLoading} canCorrect={canCorrect}
            onCorrected={() => queryClient.invalidateQueries({ queryKey: ["attendance"] })} />
        </section>
      )}

      {canViewTeam && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Today, your team</h2>
          <AttendanceTable rows={team.data} isLoading={team.isLoading} canCorrect={false} onCorrected={() => {}} />
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>My recent attendance</h2>
        <AttendanceTable rows={mine.data} isLoading={mine.isLoading} canCorrect={false} onCorrected={() => {}} />
      </section>
    </div>
  );
}

function AttendanceTable({
  rows, isLoading, canCorrect, onCorrected,
}: {
  rows?: AttendanceRow[]; isLoading: boolean; canCorrect: boolean; onCorrected: () => void;
}) {
  const correct = useMutation({
    mutationFn: ({ id, clockIn, clockOut }: { id: string; clockIn: string; clockOut: string | null }) =>
      api.patch(`/attendance/${id}`, { clockIn, clockOut }),
    onSuccess: onCorrected,
  });

  if (isLoading) return <Spinner />;

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Employee</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Clock in</th>
            <th style={styles.th}>Clock out</th>
            <th style={styles.th}>Regular</th>
            <th style={styles.th}>Overtime</th>
            {canCorrect && <th style={styles.th}></th>}
          </tr>
        </thead>
        <tbody>
          {(!rows || rows.length === 0) && (
            <tr><td style={styles.td} colSpan={canCorrect ? 7 : 6}>No entries.</td></tr>
          )}
          {rows?.map((r) => (
            <tr key={r.id}>
              <td style={styles.td}>{r.employeeName}</td>
              <td style={styles.td}>{r.workDate}</td>
              <td style={styles.td}>{new Date(r.clockIn).toLocaleTimeString()}</td>
              <td style={styles.td}>{r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : "—"}</td>
              <td style={styles.td}>{r.regularHours?.toFixed(1) ?? "—"}</td>
              <td style={styles.td}>{r.overtimeHours ? r.overtimeHours.toFixed(1) : "—"}</td>
              {canCorrect && (
                <td style={styles.td}>
                  <button
                    style={styles.secondary}
                    onClick={() => {
                      const clockOut = r.clockOut ?? new Date().toISOString();
                      correct.mutate({ id: r.id, clockIn: r.clockIn, clockOut });
                    }}
                  >
                    Close out
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 460 },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
  },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  secondary: {
    background: "var(--surface-sunken)", color: "var(--muted)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

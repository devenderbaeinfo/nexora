import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface TeamReportRow {
  employeeId: string;
  employeeName: string;
  jobTitleName: string;
  pendingLeaveRequests: number;
  leaveDaysUsedThisYear: number;
  attendanceDaysThisMonth: number;
}

export default function TeamReports() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "team"],
    queryFn: async () => (await api.get<TeamReportRow[]>("/reports/team")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Team Reports</h1>
          <p style={s.subtitle}>Leave and attendance summary for your direct reports.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>No direct reports to report on.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Job Title</th>
                <th style={s.th}>Pending leave requests</th>
                <th style={s.th}>Leave days used (this year)</th>
                <th style={s.th}>Attendance days (this month)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.employeeId}>
                  <td style={s.td}>{r.employeeName}</td>
                  <td style={s.td}>{r.jobTitleName}</td>
                  <td style={s.td}>{r.pendingLeaveRequests}</td>
                  <td style={s.td}>{r.leaveDaysUsedThisYear}</td>
                  <td style={s.td}>{r.attendanceDaysThisMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

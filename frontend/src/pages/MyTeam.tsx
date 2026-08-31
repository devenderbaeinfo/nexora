import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  jobTitleName: string;
  departmentName: string;
  status: string;
}

export default function MyTeam() {
  const { data, isLoading } = useQuery({
    queryKey: ["employees", "direct-reports"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees/direct-reports")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Team</h1>
          <p style={s.subtitle}>Everyone who reports directly to you.</p>
        </div>
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>No one reports to you yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Job Title</th>
                <th style={s.th}>Department</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td style={s.td}>{e.firstName} {e.lastName}</td>
                  <td style={s.td}>{e.jobTitleName}</td>
                  <td style={s.td}>{e.departmentName}</td>
                  <td style={s.td}>{e.workEmail}</td>
                  <td style={s.td}>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

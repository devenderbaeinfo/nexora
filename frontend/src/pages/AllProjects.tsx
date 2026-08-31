import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface ProjectRow {
  id: string;
  name: string;
  customerName: string;
  projectManagerName: string;
  status: string;
  budgetAmount: number;
}

export default function AllProjects() {
  const { can } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectRow[]>("/projects")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>All Projects</h1>
          <p style={s.subtitle}>Every project in your organization.</p>
        </div>
        {can("project.manage_budget") && (
          <Link to="/projects/create" style={{ textDecoration: "none" }}>
            <button style={s.addButton}>Create project</button>
          </Link>
        )}
      </header>

      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && <p style={s.muted}>No projects yet.</p>}

      {data && data.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Project Manager</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Budget</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td style={s.td}>{p.name}</td>
                  <td style={s.td}>{p.customerName}</td>
                  <td style={s.td}>{p.projectManagerName}</td>
                  <td style={s.td}>{p.status}</td>
                  <td style={s.td}>{p.budgetAmount.toLocaleString(undefined, { style: "currency", currency: "USD" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

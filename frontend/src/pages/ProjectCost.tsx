import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import ProjectPicker from "../components/ProjectPicker";
import { pageStyles as s, tag } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface ProjectExpenseRow {
  id: string;
  employeeName: string;
  amount: number;
  category: string;
  description: string | null;
  incurredOn: string;
  isBillable: boolean;
  status: string;
}

export default function ProjectCost() {
  const [projectId, setProjectId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["projects", projectId, "expenses"],
    queryFn: async () => (await api.get<ProjectExpenseRow[]>(`/projects/${projectId}/expenses`)).data,
    enabled: !!projectId,
  });

  const total = data?.filter((e) => e.status === "Approved").reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Project Cost</h1>
          <p style={s.subtitle}>Every itemized expense against a project, any status.</p>
        </div>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </header>

      {!projectId && <p style={s.muted}>Select a project to see its costs.</p>}
      {isLoading && <Spinner />}

      {data && (
        <>
          <div style={{ ...s.statCard, maxWidth: 240, marginBottom: 20 }}>
            <div style={s.statLabel}>Approved cost</div>
            <div style={s.statValue}>{total.toLocaleString(undefined, { style: "currency", currency: "USD" })}</div>
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Employee</th>
                  <th style={s.th}>Category</th>
                  <th style={s.th}>Amount</th>
                  <th style={s.th}>Incurred</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && <tr><td style={s.td} colSpan={5}>No expenses logged for this project.</td></tr>}
                {data.map((e) => (
                  <tr key={e.id}>
                    <td style={s.td}>{e.employeeName}</td>
                    <td style={s.td}>{e.category}</td>
                    <td style={s.td}>{e.amount.toLocaleString(undefined, { style: "currency", currency: "USD" })}</td>
                    <td style={s.td}>{e.incurredOn}</td>
                    <td style={s.td}><StatusTag status={e.status} /></td>
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

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Approved: ["var(--good-soft)", "var(--good)"],
    ManagerApproved: ["var(--warn-soft)", "var(--warn)"],
    Pending: ["var(--warn-soft)", "var(--warn)"],
    Rejected: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={tag(bg, fg)}>{status}</span>;
}

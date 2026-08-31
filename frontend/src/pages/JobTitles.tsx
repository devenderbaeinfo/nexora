import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";

interface JobTitleRow {
  id: string;
  name: string;
  systemRole: string;
}

export default function JobTitles() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [systemRole, setSystemRole] = useState("");

  const jobTitles = useQuery({
    queryKey: ["jobTitles"],
    queryFn: async () => (await api.get<JobTitleRow[]>("/job-titles")).data,
  });

  const assignableRoles = useQuery({
    queryKey: ["assignableRoles"],
    queryFn: async () => (await api.get<string[]>("/users/assignable-roles")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/job-titles", { name, systemRole }),
    onSuccess: () => {
      setName(""); setSystemRole("");
      queryClient.invalidateQueries({ queryKey: ["jobTitles"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, systemRole: role }: { id: string; systemRole: string }) =>
      api.patch(`/job-titles/${id}`, { systemRole: role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobTitles"] }),
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Job Titles</h1>
          <p style={s.subtitle}>Every job title grants an access-control role — this is what "Add person" uses instead of a separate role pick.</p>
        </div>
      </header>

      <section style={{ ...s.card, marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...s.input, minWidth: 200 }} placeholder="New job title" value={name} onChange={(e) => setName(e.target.value)} />
        <select style={s.select} value={systemRole} onChange={(e) => setSystemRole(e.target.value)}>
          <option value="" disabled>Select a role</option>
          {assignableRoles.data?.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          style={s.addButton}
          disabled={!name.trim() || !systemRole || create.isPending}
          onClick={() => create.mutate()}
        >
          Add job title
        </button>
      </section>

      {create.isError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>
          {(create.error as any)?.response?.data ?? "Couldn't create this job title."}
        </p>
      )}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Job title</th>
              <th style={s.th}>Grants role</th>
            </tr>
          </thead>
          <tbody>
            {jobTitles.data?.map((j) => (
              <tr key={j.id}>
                <td style={s.td}>{j.name}</td>
                <td style={s.td}>
                  <select
                    style={s.select}
                    value={j.systemRole}
                    onChange={(e) => update.mutate({ id: j.id, systemRole: e.target.value })}
                  >
                    {assignableRoles.data?.map((r) => <option key={r} value={r}>{r}</option>)}
                    {!assignableRoles.data?.includes(j.systemRole) && (
                      <option value={j.systemRole}>{j.systemRole}</option>
                    )}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

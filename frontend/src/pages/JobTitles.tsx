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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  const jobTitles = useQuery({
    queryKey: ["jobTitles"],
    queryFn: async () => (await api.get<JobTitleRow[]>("/job-titles")).data,
  });

  // Deliberately a different endpoint from Add Person's — this one lists every role a Job
  // Title may be labeled with (including Admin-created custom roles), not just the narrower
  // set the caller could personally hire into.
  const assignableRoles = useQuery({
    queryKey: ["jobTitles", "assignableRoles"],
    queryFn: async () => (await api.get<string[]>("/job-titles/assignable-roles")).data,
  });

  const create = useMutation({
    mutationFn: () => api.post("/job-titles", { name, systemRole }),
    onSuccess: () => {
      setName(""); setSystemRole("");
      queryClient.invalidateQueries({ queryKey: ["jobTitles"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, name: newName, systemRole: role }: { id: string; name: string; systemRole: string }) =>
      api.patch(`/job-titles/${id}`, { name: newName, systemRole: role }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["jobTitles"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/job-titles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobTitles"] }),
  });

  const startEditing = (j: JobTitleRow) => {
    setEditingId(j.id);
    setEditName(j.name);
    setEditRole(j.systemRole);
  };

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
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {jobTitles.data?.map((j) => {
              const isEditing = editingId === j.id;
              return (
                <tr key={j.id}>
                  <td style={s.td}>
                    {isEditing
                      ? <input style={{ ...s.input, minWidth: 160 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      : j.name}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <select style={s.select} value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                        {assignableRoles.data?.map((r) => <option key={r} value={r}>{r}</option>)}
                        {!assignableRoles.data?.includes(j.systemRole) && (
                          <option value={j.systemRole}>{j.systemRole}</option>
                        )}
                      </select>
                    ) : j.systemRole}
                  </td>
                  <td style={s.td}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          style={s.approve}
                          disabled={!editName.trim() || update.isPending}
                          onClick={() => update.mutate({ id: j.id, name: editName.trim(), systemRole: editRole })}
                        >
                          Save
                        </button>
                        <button style={s.secondary} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={s.secondary} onClick={() => startEditing(j)}>Edit</button>
                        <button
                          style={s.reject}
                          disabled={remove.isPending && remove.variables === j.id}
                          onClick={() => {
                            if (confirm(`Delete the "${j.name}" job title? This can't be undone.`)) remove.mutate(j.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {update.isError && isEditing && (
                      <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                        {(update.error as any)?.response?.data ?? "Couldn't save this job title."}
                      </div>
                    )}
                    {remove.isError && remove.variables === j.id && (
                      <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>
                        {(remove.error as any)?.response?.data ?? "Couldn't delete this job title."}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

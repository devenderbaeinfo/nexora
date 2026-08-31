import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";

interface ProjectListItem {
  id: string;
  name: string;
}

// Shared across the Project Planning/Team/Progress/Budget pages — they all need "which
// project am I looking at" before they can show anything, and there's no per-project route yet.
export default function ProjectPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<ProjectListItem[]>("/projects")).data,
  });

  return (
    <select style={s.select} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a project…</option>
      {data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

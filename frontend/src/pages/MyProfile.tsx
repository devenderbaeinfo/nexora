import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { pageStyles as s } from "../styles/pageKit";
import Spinner from "../components/Spinner";

interface EmployeeProfile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  personalPhone: string | null;
  jobTitleName: string;
  departmentName: string;
  locationName: string | null;
  status: string;
  hireDate: string;
}

export default function MyProfile() {
  const { data, isLoading } = useQuery({
    queryKey: ["employees", "me"],
    queryFn: async () => (await api.get<EmployeeProfile>("/employees/me")).data,
  });

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>My Profile</h1>
          <p style={s.subtitle}>Your personal details on file with HR.</p>
        </div>
      </header>

      {isLoading && <Spinner />}

      {data && (
        <div style={{ ...s.card, maxWidth: 480 }}>
          <Row label="Employee ID" value={data.employeeCode} />
          <Row label="Name" value={`${data.firstName} ${data.lastName}`} />
          <Row label="Work email" value={data.workEmail} />
          <Row label="Personal phone" value={data.personalPhone ?? "—"} />
          <Row label="Job title" value={data.jobTitleName} />
          <Row label="Department" value={data.departmentName} />
          <Row label="Location" value={data.locationName ?? "—"} />
          <Row label="Status" value={data.status} />
          <Row label="Hire date" value={data.hireDate} last />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "10px 0",
      borderBottom: last ? "none" : "1px solid var(--border)", fontSize: 13.5,
    }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

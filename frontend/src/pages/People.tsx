import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import AddPersonForm from "./AddPersonForm";
import ResetPasswordAction from "./ResetPasswordAction";
import DeleteUserAction from "./DeleteUserAction";
import ManageLeaveBalances from "./ManageLeaveBalances";
import SetManagerForm from "./SetManagerForm";
import DataTable, { type DataTableColumn } from "../components/DataTable";

interface EmployeeListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  jobTitleName: string;
  departmentName: string;
  status: string;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
}

interface UserSummary {
  userId: string;
  employeeId: string;
  displayName: string;
  workEmail: string;
  role: string;
  canDelete: boolean;
  passwordResetRequested: boolean;
}

export default function People() {
  const { can } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [leaveEmployee, setLeaveEmployee] = useState<EmployeeListItem | null>(null);
  const [managerEmployee, setManagerEmployee] = useState<EmployeeListItem | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
  });

  const accounts = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<UserSummary[]>("/users")).data,
    enabled: can("admin.manage_users"),
  });

  const columns: DataTableColumn<EmployeeListItem>[] = [
    {
      key: "name", header: "Name",
      value: (e) => `${e.firstName} ${e.lastName} ${e.workEmail} ${e.employeeCode}`,
      render: (e) => (
        <Link to={`/people/${e.id}`} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 600, color: "var(--accent)" }}>{e.firstName} {e.lastName}</div>
          <div style={{ color: "var(--faint)", fontSize: 12.5 }}>{e.workEmail}</div>
        </Link>
      ),
    },
    {
      key: "employeeCode", header: "Employee ID",
      value: (e) => e.employeeCode,
      render: (e) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{e.employeeCode}</span>,
    },
    { key: "jobTitle", header: "Job Title", value: (e) => e.jobTitleName, render: (e) => e.jobTitleName },
    { key: "department", header: "Department", value: (e) => e.departmentName, render: (e) => e.departmentName },
    {
      key: "manager", header: "Manager", value: (e) => e.reportingManagerName ?? "None set",
      render: (e) => e.reportingManagerName ?? <span style={{ color: "var(--danger)" }}>None set</span>,
    },
    { key: "status", header: "Status", value: (e) => e.status, render: (e) => <StatusTag status={e.status} /> },
    ...(can("people.manage") ? [{
      key: "actions", header: "",
      render: (e: EmployeeListItem) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.leaveButton} onClick={() => setManagerEmployee(e)}>Set manager</button>
          {can("leave.configure_policy") && (
            <button style={styles.leaveButton} onClick={() => setLeaveEmployee(e)}>Manage leave</button>
          )}
        </div>
      ),
    } satisfies DataTableColumn<EmployeeListItem>] : []),
  ];

  const exportSelected = (ids: string[]) => {
    const rows = (data ?? []).filter((e) => ids.includes(e.id));
    const header = ["Employee ID", "Name", "Email", "Job Title", "Department", "Manager", "Status"];
    const lines = rows.map((e) => [
      e.employeeCode, `${e.firstName} ${e.lastName}`, e.workEmail, e.jobTitleName, e.departmentName,
      e.reportingManagerName ?? "None set", e.status,
    ].map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>People</h1>
          <p style={styles.subtitle}>Every employee record, in one place — entered once, used everywhere.</p>
        </div>
        {can("admin.manage_users") && (
          <button style={styles.addButton} onClick={() => setAddOpen(true)}>Add person</button>
        )}
      </header>

      <Drawer open={addOpen} title="Add person" onClose={() => setAddOpen(false)}>
        <AddPersonForm onDone={() => setAddOpen(false)} />
      </Drawer>

      <Drawer open={!!leaveEmployee} title={`Leave allotment — ${leaveEmployee?.firstName ?? ""} ${leaveEmployee?.lastName ?? ""}`} onClose={() => setLeaveEmployee(null)}>
        {leaveEmployee && <ManageLeaveBalances employeeId={leaveEmployee.id} onDone={() => setLeaveEmployee(null)} />}
      </Drawer>

      <Drawer open={!!managerEmployee} title={`Reporting manager — ${managerEmployee?.firstName ?? ""} ${managerEmployee?.lastName ?? ""}`} onClose={() => setManagerEmployee(null)}>
        {managerEmployee && (
          <SetManagerForm
            employeeId={managerEmployee.id}
            currentManagerId={managerEmployee.reportingManagerId}
            onDone={() => setManagerEmployee(null)}
          />
        )}
      </Drawer>

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        errorMessage="Couldn't load the team. Try refreshing."
        emptyMessage="No employees yet."
        searchPlaceholder="Search by name, email, title, or department…"
        exportFileName="employees"
        selectable={can("people.manage")}
        bulkActions={can("people.manage") ? (ids) => (
          <button style={styles.leaveButton} onClick={() => exportSelected(ids)}>Export selected</button>
        ) : undefined}
      />

      {can("admin.manage_users") && accounts.data && accounts.data.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h2 style={styles.sectionTitle}>Accounts you manage</h2>
          <p style={{ ...styles.subtitle, marginBottom: 16 }}>Reset a password if someone's forgotten theirs — they'll be forced to set a new one on next sign-in.</p>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {[...accounts.data].sort((a, b) => Number(b.passwordResetRequested) - Number(a.passwordResetRequested)).map((u) => (
                  <tr key={u.userId}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                      <div style={{ color: "var(--faint)", fontSize: 12.5 }}>{u.workEmail}</div>
                    </td>
                    <td style={styles.td}>{u.role}</td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <ResetPasswordAction userId={u.userId} label={u.displayName} requested={u.passwordResetRequested} />
                        {u.canDelete && <DeleteUserAction userId={u.userId} label={u.displayName} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Active: ["var(--good-soft)", "var(--good)"],
    OnLeave: ["var(--warn-soft)", "var(--warn)"],
    Terminated: ["var(--surface-sunken)", "var(--faint)"],
  };
  const [bg, fg] = palette[status] ?? palette.Active;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: bg, color: fg, padding: "3px 9px", borderRadius: 20 }}>{status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 4, color: "var(--ink)" },
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
  tag: {
    fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--good-soft)",
    color: "var(--good)", padding: "3px 9px", borderRadius: 20,
  },
  leaveButton: {
    background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)",
    fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

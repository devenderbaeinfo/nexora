import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";

interface Department { id: string; name: string; }
interface JobTitle { id: string; name: string; systemRole: string; }
interface LeaveType { id: string; name: string; annualAllowance: number; }
interface EmployeeOption { id: string; firstName: string; lastName: string; jobTitleName: string; }

export default function AddPersonForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<Department[]>("/departments")).data,
  });
  const { data: jobTitles } = useQuery({
    queryKey: ["jobTitles"],
    queryFn: async () => (await api.get<JobTitle[]>("/job-titles")).data,
  });
  const { data: assignableRoles } = useQuery({
    queryKey: ["assignableRoles"],
    queryFn: async () => (await api.get<string[]>("/users/assignable-roles")).data,
  });
  const { data: leaveTypes } = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: async () => (await api.get<LeaveType[]>("/leave-types")).data,
  });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeOption[]>("/employees")).data,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [newJobTitleName, setNewJobTitleName] = useState("");
  const [newJobTitleSystemRole, setNewJobTitleSystemRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [acknowledgeNoManager, setAcknowledgeNoManager] = useState(false);
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // HR picks which leave types this hire gets and how many days of each — defaults to every
  // type at its configured allowance, but any of it can be unchecked or adjusted per person.
  const [leaveIncluded, setLeaveIncluded] = useState<Record<string, boolean>>({});
  const [leaveDays, setLeaveDays] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!leaveTypes) return;
    setLeaveIncluded((prev) => {
      const next = { ...prev };
      for (const t of leaveTypes) if (!(t.id in next)) next[t.id] = true;
      return next;
    });
    setLeaveDays((prev) => {
      const next = { ...prev };
      for (const t of leaveTypes) if (!(t.id in next)) next[t.id] = t.annualAllowance;
      return next;
    });
  }, [leaveTypes]);

  const mutation = useMutation({
    mutationFn: async () => {
      // A brand-new company has zero departments/job titles to pick from — let this form
      // create either inline rather than sending HR off to a separate screen first.
      let resolvedDepartmentId = departmentId;
      if (!resolvedDepartmentId && newDepartmentName.trim()) {
        const { data } = await api.post("/departments", { name: newDepartmentName.trim() });
        resolvedDepartmentId = data.id;
      }
      let resolvedJobTitleId = jobTitleId;
      if (!resolvedJobTitleId && newJobTitleName.trim()) {
        const { data } = await api.post("/job-titles", { name: newJobTitleName.trim(), systemRole: newJobTitleSystemRole });
        resolvedJobTitleId = data.id;
      }
      const leaveAllotments = (leaveTypes ?? [])
        .filter((t) => leaveIncluded[t.id])
        .map((t) => ({ leaveTypeId: t.id, allotted: leaveDays[t.id] ?? 0 }));

      return api.post("/users", {
        firstName, lastName, workEmail,
        jobTitleId: resolvedJobTitleId, departmentId: resolvedDepartmentId, hireDate, password,
        reportingManagerId: reportingManagerId || null,
        acknowledgeNoManager: !reportingManagerId && acknowledgeNoManager,
        leaveAllotments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["jobTitles"] });
      onDone();
    },
    onError: (err: any) => {
      setError(err?.response?.status === 409
        ? "Someone with this work email already exists."
        : (err?.response?.data ?? "Couldn't create this person. Check the fields and try again."));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!departmentId && !newDepartmentName.trim()) {
      setError("Pick an existing department or name a new one.");
      return;
    }
    if (!jobTitleId && !newJobTitleName.trim()) {
      setError("Pick an existing job title or name a new one.");
      return;
    }
    if (!jobTitleId && !newJobTitleSystemRole) {
      setError("Pick which access-control role the new job title grants.");
      return;
    }
    if (!reportingManagerId && !acknowledgeNoManager) {
      setError("Pick a reporting manager, or confirm this person has none.");
      return;
    }
    mutation.mutate();
  };

  if (assignableRoles && assignableRoles.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>Your role doesn't grant permission to add people.</p>;
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={s.row}>
        <div>
          <label style={s.label} htmlFor="firstName">First name</label>
          <input id="firstName" style={s.field} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div>
          <label style={s.label} htmlFor="lastName">Last name</label>
          <input id="lastName" style={s.field} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>

      <label style={s.label} htmlFor="workEmail">Work email</label>
      <input id="workEmail" type="email" style={s.field} value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} required />

      <label style={s.label} htmlFor="jobTitle">Job title</label>
      <select
        id="jobTitle" style={s.field} value={jobTitleId}
        onChange={(e) => { setJobTitleId(e.target.value); if (e.target.value) setNewJobTitleName(""); }}
      >
        <option value="">— New job title —</option>
        {jobTitles?.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
      </select>
      {jobTitleId && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "-8px 0 12px" }}>
          Grants the {jobTitles?.find((j) => j.id === jobTitleId)?.systemRole} role.
        </p>
      )}
      {!jobTitleId && (
        <>
          <label style={s.label} htmlFor="newJobTitle">New job title name</label>
          <input
            id="newJobTitle" style={s.field} value={newJobTitleName}
            onChange={(e) => setNewJobTitleName(e.target.value)}
          />

          <label style={s.label} htmlFor="newJobTitleRole">Access role this title grants</label>
          <select
            id="newJobTitleRole" style={s.field} value={newJobTitleSystemRole}
            onChange={(e) => setNewJobTitleSystemRole(e.target.value)} required
          >
            <option value="" disabled>Select a role</option>
            {assignableRoles?.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </>
      )}

      <label style={s.label} htmlFor="department">Department</label>
      <select
        id="department" style={s.field} value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
      >
        <option value="">— New department —</option>
        {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      {!departmentId && (
        <>
          <label style={s.label} htmlFor="newDepartment">New department name</label>
          <input
            id="newDepartment" style={s.field} value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
          />
        </>
      )}

      <label style={s.label} htmlFor="reportingManager">Reporting manager</label>
      <select
        id="reportingManager" style={s.field} value={reportingManagerId}
        onChange={(e) => { setReportingManagerId(e.target.value); if (e.target.value) setAcknowledgeNoManager(false); }}
      >
        <option value="">— Select a manager —</option>
        {employees?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.jobTitleName}</option>)}
      </select>
      {!reportingManagerId && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, margin: "-8px 0 12px" }}>
          <input
            type="checkbox" checked={acknowledgeNoManager}
            onChange={(e) => setAcknowledgeNoManager(e.target.checked)}
          />
          This person has no manager — top of the org chart
        </label>
      )}

      {leaveTypes && leaveTypes.length > 0 && (
        <>
          <label style={s.label}>Leave allotment</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {leaveTypes.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={leaveIncluded[t.id] ?? true}
                  onChange={(e) => setLeaveIncluded((prev) => ({ ...prev, [t.id]: e.target.checked }))}
                />
                <span style={{ flex: 1, fontSize: 13.5 }}>{t.name}</span>
                <input
                  type="number" min={0} step={0.5}
                  style={{ ...s.field, width: 80, marginBottom: 0 }}
                  disabled={!(leaveIncluded[t.id] ?? true)}
                  value={leaveDays[t.id] ?? t.annualAllowance}
                  onChange={(e) => setLeaveDays((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
                />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>days</span>
              </div>
            ))}
          </div>
        </>
      )}

      <label style={s.label} htmlFor="hireDate">Start date</label>
      <input id="hireDate" type="date" style={s.field} value={hireDate} onChange={(e) => setHireDate(e.target.value)} required />

      <label style={s.label} htmlFor="password">Temporary password</label>
      <input id="password" type="password" style={s.field} value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required />

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" style={s.button} disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create account"}
        </button>
      </div>
    </form>
  );
}

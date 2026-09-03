import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import Spinner from "../components/Spinner";
import SetManagerForm from "./SetManagerForm";
import ManageLeaveBalances from "./ManageLeaveBalances";
import AddEmployeeDocumentForm from "./AddEmployeeDocumentForm";
import SetSalaryStructureForm from "./SetSalaryStructureForm";
import PayslipDetailView from "./PayslipDetailView";
import { pageStyles as s, tag } from "../styles/pageKit";
import { formatCurrency } from "../lib/currency";

interface EmployeeDetail {
  id: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  personalPhone: string | null;
  jobTitleName: string;
  departmentName: string;
  locationName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  status: string;
  hireDate: string;
}

interface LeaveBalanceRow {
  leaveTypeId: string;
  leaveTypeName: string;
  allotted: number;
  used: number;
  remaining: number;
}

interface DocumentRow {
  id: string;
  type: string;
  originalFileName: string;
  status: string;
  expiresOn: string | null;
  createdAtUtc: string;
}

interface OnboardingTaskRow {
  id: string;
  title: string;
  category: string;
  status: string;
  dueDate: string | null;
}

interface FnfCaseRow {
  id: string;
  status: string;
  finalPayoutAmount: number | null;
  closedAtUtc: string | null;
}

interface SalaryComponentDto { id: string; name: string; type: string; calculationType: string; value: number; isBasic: boolean; }
interface SalaryStructureDto { id: string; effectiveFrom: string; components: SalaryComponentDto[]; }
interface PayslipListItemRow { id: string; grossEarnings: number; lopDays: number; lopDeduction: number; otherDeductions: number; netPay: number; }

const TABS = ["Overview", "Leave", "Payroll", "Documents", "Onboarding", "Full & Final Settlement"] as const;
type Tab = typeof TABS[number];

// The record-detail workspace: an employee is more than one row in a table — this page
// gathers everything HR/a manager needs about one specific person, tabbed instead of forcing
// a hunt across five different top-level pages each re-selecting the same employee.
export default function EmployeeProfile() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("Overview");
  const [managerOpen, setManagerOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [openPayslipId, setOpenPayslipId] = useState<string | null>(null);

  const employee = useQuery({
    queryKey: ["employees", employeeId],
    queryFn: async () => (await api.get<EmployeeDetail>(`/employees/${employeeId}`)).data,
    enabled: !!employeeId,
  });

  const leaveBalances = useQuery({
    queryKey: ["leave-requests", "balances", employeeId],
    queryFn: async () => (await api.get<LeaveBalanceRow[]>(`/leave-requests/balances/${employeeId}`)).data,
    enabled: !!employeeId && tab === "Leave" && can("leave.configure_policy"),
  });

  const salaryStructure = useQuery({
    queryKey: ["payroll", "salary-structure", employeeId],
    queryFn: async () => (await api.get<SalaryStructureDto | null>(`/payroll/salary-structures/${employeeId}`)).data,
    enabled: !!employeeId && tab === "Payroll" && can("payroll.view"),
  });

  const payslips = useQuery({
    queryKey: ["payroll", "employee-payslips", employeeId],
    queryFn: async () => (await api.get<PayslipListItemRow[]>(`/payroll/employees/${employeeId}/payslips`)).data,
    enabled: !!employeeId && tab === "Payroll" && can("payroll.view"),
  });

  const documents = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => (await api.get<DocumentRow[]>(`/employee-documents/employees/${employeeId}`)).data,
    enabled: !!employeeId && tab === "Documents" && can("employee_docs.view"),
  });

  const onboarding = useQuery({
    queryKey: ["onboarding", "employee", employeeId],
    queryFn: async () => (await api.get<OnboardingTaskRow[]>(`/onboarding/employees/${employeeId}`)).data,
    enabled: !!employeeId && tab === "Onboarding" && can("onboarding.view"),
  });

  const fnf = useQuery({
    queryKey: ["fnf", "employee", employeeId],
    queryFn: async () => (await api.get<FnfCaseRow[]>(`/fnf/employees/${employeeId}`)).data,
    enabled: !!employeeId && tab === "Full & Final Settlement" && can("fnf.view"),
  });

  if (employee.isLoading) return <Spinner />;
  if (employee.isError || !employee.data) {
    return (
      <div>
        <p style={{ color: "var(--danger)" }}>Couldn't load this employee. They may not exist, or you may not have access.</p>
        <Link to="/">← Back to directory</Link>
      </div>
    );
  }

  const e = employee.data;

  return (
    <div>
      <Link to="/" style={backLink}>← Employee Directory</Link>

      <header style={{ ...s.header, marginTop: 12 }}>
        <div>
          <h1 style={s.title}>{e.firstName} {e.lastName}</h1>
          <p style={s.subtitle}>{e.jobTitleName} · {e.departmentName}</p>
        </div>
        {(can("people.manage") || can("employee_docs.manage") || can("payroll.manage")) && (
          <div style={{ display: "flex", gap: 8 }}>
            {can("people.manage") && (
              <button style={s.secondary} onClick={() => setManagerOpen(true)}>Set manager</button>
            )}
            {can("people.manage") && can("leave.configure_policy") && (
              <button style={s.secondary} onClick={() => setLeaveOpen(true)}>Manage leave</button>
            )}
            {can("payroll.manage") && (
              <button style={s.secondary} onClick={() => setSalaryOpen(true)}>Set salary</button>
            )}
            {can("employee_docs.manage") && (
              <button style={s.secondary} onClick={() => setDocumentOpen(true)}>Add document</button>
            )}
          </div>
        )}
      </header>

      <div style={tabBar}>
        {TABS.map((t) => (
          <button
            key={t}
            style={{ ...tabButton, ...(tab === t ? tabButtonActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div style={{ ...s.card, maxWidth: 520 }}>
          <OverviewRow label="Email" value={e.workEmail} />
          <OverviewRow label="Phone" value={e.personalPhone ?? "—"} />
          <OverviewRow label="Job Title" value={e.jobTitleName} />
          <OverviewRow label="Department" value={e.departmentName} />
          <OverviewRow label="Location" value={e.locationName ?? "—"} />
          <OverviewRow
            label="Reporting Manager"
            value={e.reportingManagerName ?? "None set"}
            valueColor={e.reportingManagerName ? undefined : "var(--danger)"}
          />
          <OverviewRow label="Status" value={e.status} />
          <OverviewRow label="Hire Date" value={e.hireDate} last />
        </div>
      )}

      {tab === "Leave" && (
        !can("leave.configure_policy") ? <p style={s.muted}>You don't have access to this employee's leave balances.</p> :
        leaveBalances.isLoading ? <Spinner /> : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Leave Type</th><th style={s.th}>Allotted</th><th style={s.th}>Used</th><th style={s.th}>Remaining</th></tr></thead>
              <tbody>
                {leaveBalances.data?.map((b) => (
                  <tr key={b.leaveTypeId}>
                    <td style={s.td}>{b.leaveTypeName}</td>
                    <td style={s.td}>{b.allotted}</td>
                    <td style={s.td}>{b.used}</td>
                    <td style={s.td}>{b.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "Payroll" && (
        !can("payroll.view") ? <p style={s.muted}>You don't have access to this employee's payroll.</p> : (
          <>
            <section style={{ ...s.section }}>
              <h2 style={s.sectionTitle}>Current salary structure</h2>
              {salaryStructure.isLoading ? <Spinner /> : !salaryStructure.data ? (
                <p style={s.muted}>No salary structure set up yet.</p>
              ) : (
                <div style={{ ...s.card, maxWidth: 520 }}>
                  {salaryStructure.data.components.map((c, i) => (
                    <OverviewRow
                      key={c.id}
                      label={c.name + (c.isBasic ? " (Basic)" : "")}
                      value={c.calculationType === "FixedAmount"
                        ? formatCurrency(c.value)
                        : `${c.value}% of Basic`}
                      last={i === salaryStructure.data!.components.length - 1}
                    />
                  ))}
                </div>
              )}
            </section>

            <section style={s.section}>
              <h2 style={s.sectionTitle}>Payslip history</h2>
              {payslips.isLoading ? <Spinner /> : (
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead><tr><th style={s.th}>Gross</th><th style={s.th}>LOP days</th><th style={s.th}>Deductions</th><th style={s.th}>Net pay</th><th style={s.th}></th></tr></thead>
                    <tbody>
                      {(!payslips.data || payslips.data.length === 0) && <tr><td style={s.td} colSpan={5}>No payslips yet.</td></tr>}
                      {payslips.data?.map((p) => (
                        <tr key={p.id}>
                          <td style={s.td}>{formatCurrency(p.grossEarnings)}</td>
                          <td style={s.td}>{p.lopDays || "—"}</td>
                          <td style={s.td}>{formatCurrency(p.lopDeduction + p.otherDeductions)}</td>
                          <td style={s.td}><strong>{formatCurrency(p.netPay)}</strong></td>
                          <td style={s.td}><button style={s.secondary} onClick={() => setOpenPayslipId(p.id)}>View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}

      {tab === "Documents" && (
        !can("employee_docs.view") ? <p style={s.muted}>You don't have access to this employee's documents.</p> :
        documents.isLoading ? <Spinner /> : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Type</th><th style={s.th}>File</th><th style={s.th}>Status</th><th style={s.th}>Expires</th></tr></thead>
              <tbody>
                {(!documents.data || documents.data.length === 0) && <tr><td style={s.td} colSpan={4}>No documents on file.</td></tr>}
                {documents.data?.map((d) => (
                  <tr key={d.id}>
                    <td style={s.td}>{d.type}</td>
                    <td style={s.td}>{d.originalFileName}</td>
                    <td style={s.td}><span style={tag("var(--surface-sunken)", "var(--muted)")}>{d.status}</span></td>
                    <td style={s.td}>{d.expiresOn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "Onboarding" && (
        !can("onboarding.view") ? <p style={s.muted}>You don't have access to this employee's onboarding plan.</p> :
        onboarding.isLoading ? <Spinner /> : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Task</th><th style={s.th}>Category</th><th style={s.th}>Status</th><th style={s.th}>Due</th></tr></thead>
              <tbody>
                {(!onboarding.data || onboarding.data.length === 0) && <tr><td style={s.td} colSpan={4}>No onboarding plan started.</td></tr>}
                {onboarding.data?.map((t) => (
                  <tr key={t.id}>
                    <td style={s.td}>{t.title}</td>
                    <td style={s.td}>{t.category}</td>
                    <td style={s.td}><span style={tag("var(--surface-sunken)", "var(--muted)")}>{t.status}</span></td>
                    <td style={s.td}>{t.dueDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "Full & Final Settlement" && (
        !can("fnf.view") ? <p style={s.muted}>You don't have access to this employee's settlement records.</p> :
        fnf.isLoading ? <Spinner /> : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Status</th><th style={s.th}>Final Payout</th><th style={s.th}>Closed</th></tr></thead>
              <tbody>
                {(!fnf.data || fnf.data.length === 0) && <tr><td style={s.td} colSpan={3}>No settlement case on record.</td></tr>}
                {fnf.data?.map((c) => (
                  <tr key={c.id}>
                    <td style={s.td}><span style={tag("var(--surface-sunken)", "var(--muted)")}>{c.status}</span></td>
                    <td style={s.td}>{c.finalPayoutAmount != null ? formatCurrency(c.finalPayoutAmount) : "—"}</td>
                    <td style={s.td}>{c.closedAtUtc ? new Date(c.closedAtUtc).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Drawer open={managerOpen} title={`Reporting manager — ${e.firstName} ${e.lastName}`} onClose={() => setManagerOpen(false)}>
        <SetManagerForm
          employeeId={e.id}
          currentManagerId={e.reportingManagerId}
          onDone={() => { setManagerOpen(false); navigate(0); }}
        />
      </Drawer>

      <Drawer open={leaveOpen} title={`Leave allotment — ${e.firstName} ${e.lastName}`} onClose={() => setLeaveOpen(false)}>
        <ManageLeaveBalances employeeId={e.id} onDone={() => setLeaveOpen(false)} />
      </Drawer>

      <Drawer open={documentOpen} title={`Add document — ${e.firstName} ${e.lastName}`} onClose={() => setDocumentOpen(false)}>
        <AddEmployeeDocumentForm employeeId={e.id} onDone={() => { setDocumentOpen(false); setTab("Documents"); }} />
      </Drawer>

      <Drawer open={salaryOpen} title={`Salary structure — ${e.firstName} ${e.lastName}`} onClose={() => setSalaryOpen(false)}>
        <SetSalaryStructureForm employeeId={e.id} onDone={() => { setSalaryOpen(false); setTab("Payroll"); }} />
      </Drawer>

      <Drawer open={!!openPayslipId} title="Payslip" onClose={() => setOpenPayslipId(null)}>
        {openPayslipId && <PayslipDetailView payslipId={openPayslipId} />}
      </Drawer>
    </div>
  );
}

function OverviewRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: valueColor ?? "var(--ink)" }}>{value}</span>
    </div>
  );
}

const backLink: React.CSSProperties = { fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 };

const tabBar: React.CSSProperties = {
  display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20, flexWrap: "wrap",
};

const tabButton: React.CSSProperties = {
  background: "none", border: "none", borderBottom: "2px solid transparent", cursor: "pointer",
  padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--muted)", font: "inherit",
};

const tabButtonActive: React.CSSProperties = {
  color: "var(--accent)", borderBottom: "2px solid var(--accent)",
};

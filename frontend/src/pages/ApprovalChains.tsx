import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Spinner from "../components/Spinner";
import { pageStyles as s } from "../styles/pageKit";

type ScopeType = "Global" | "Role" | "JobTitle";
type ResolutionType = "ReportingManager" | "SkipLevelManager" | "SpecificEmployee" | "RoleHolders" | "Fallback";

interface RoleOption { id: string; name: string }
interface JobTitleOption { id: string; name: string }
interface EmployeeOption { id: string; firstName: string; lastName: string }

interface StageDto {
  id: string;
  stageOrder: number;
  stageName: string;
  isHrStage: boolean;
  resolutionType: ResolutionType;
  approverEmployeeId: string | null;
  approverEmployeeName: string | null;
  approverRoleId: string | null;
  approverRoleName: string | null;
}

interface ChainDto {
  id: string;
  entityType: string;
  scopeType: ScopeType;
  scopeKey: string | null;
  scopeName: string | null;
  isActive: boolean;
  stages: StageDto[];
}

interface StageInput {
  stageName: string;
  isHrStage: boolean;
  resolutionType: ResolutionType;
  approverEmployeeId: string | null;
  approverRoleId: string | null;
}

const resolutionLabels: Record<ResolutionType, string> = {
  ReportingManager: "Reporting manager",
  SkipLevelManager: "Skip-level manager (manager's manager)",
  SpecificEmployee: "Specific employee",
  RoleHolders: "Anyone holding a role",
  Fallback: "Tenant fallback approver",
};

function blankStage(order: number): StageInput {
  return {
    stageName: order === 0 ? "Manager" : `Manager${order + 1}`,
    isHrStage: false,
    resolutionType: "ReportingManager",
    approverEmployeeId: null,
    approverRoleId: null,
  };
}

// Admin-facing page for the "how many approvals, and by whom" chain configuration behind
// LeaveRequest — see ApprovalChainController on the backend and IApprovalChainResolver for the
// resolution semantics. Mirrors ReportAccess.tsx's shape (a new-item form above a table of
// existing rows) but each row here expands to its own ordered stage editor since a chain is a
// list, not a single grant.
export default function ApprovalChains() {
  const queryClient = useQueryClient();

  const chains = useQuery({
    queryKey: ["approval-chains"],
    queryFn: async () => (await api.get<ChainDto[]>("/approval-chains")).data,
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.get<RoleOption[]>("/roles")).data,
  });
  const jobTitles = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () => (await api.get<JobTitleOption[]>("/job-titles")).data,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeOption[]>("/employees")).data,
  });

  const [scopeType, setScopeType] = useState<ScopeType>("Global");
  const [scopeKey, setScopeKey] = useState("");
  const [stages, setStages] = useState<StageInput[]>([blankStage(0)]);
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post("/approval-chains", {
        scopeType,
        scopeKey: scopeType === "Global" ? null : scopeKey || null,
        stages,
      }),
    onSuccess: () => {
      setScopeType("Global"); setScopeKey(""); setStages([blankStage(0)]); setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["approval-chains"] });
    },
    onError: (err: any) => setFormError(err?.response?.data ?? "Couldn't create this chain."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/approval-chains/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approval-chains"] }),
  });

  const toggleActive = useMutation({
    mutationFn: (chain: ChainDto) =>
      api.put(`/approval-chains/${chain.id}`, {
        isActive: !chain.isActive,
        stages: chain.stages.map((st) => ({
          stageName: st.stageName, isHrStage: st.isHrStage, resolutionType: st.resolutionType,
          approverEmployeeId: st.approverEmployeeId, approverRoleId: st.approverRoleId,
        })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approval-chains"] }),
  });

  const updateStage = (i: number, patch: Partial<StageInput>) =>
    setStages((prev) => prev.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));

  const addStage = () => setStages((prev) => [...prev, blankStage(prev.length)]);
  const removeStage = (i: number) => setStages((prev) => prev.filter((_, idx) => idx !== i));
  const moveStage = (i: number, dir: -1 | 1) =>
    setStages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const canSubmit = (scopeType === "Global" || scopeKey !== "") && stages.every((st) => st.stageName.trim() !== "");

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Approval Chains</h1>
          <p style={s.subtitle}>
            Every employee's leave defaults to one manager approval then HR sign-off. Configure a
            chain here — per Role or Job Title, or one tenant-wide Global default — to require
            extra manager approvals, or to swap in a specific approver, without any code change.
            An employee with no matching chain below keeps today's default behavior.
          </p>
        </div>
      </header>

      <section style={{ ...s.card, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 14px" }}>New chain</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
              Applies to
              <select style={s.select} value={scopeType} onChange={(e) => { setScopeType(e.target.value as ScopeType); setScopeKey(""); }}>
                <option value="Global">Global (tenant-wide default)</option>
                <option value="Role">A specific role</option>
                <option value="JobTitle">A specific job title</option>
              </select>
            </label>

            {scopeType === "Role" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
                Role
                <select style={s.select} value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
                  <option value="">— Select a role —</option>
                  {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            )}
            {scopeType === "JobTitle" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--muted)" }}>
                Job title
                <select style={s.select} value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
                  <option value="">— Select a job title —</option>
                  {jobTitles.data?.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Stages, in order</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stages.map((stage, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>#{i + 1}</span>
                    <input
                      style={{ ...s.input, flex: "1 1 140px" }}
                      placeholder="Stage name (e.g. Manager, Manager2, HR)"
                      value={stage.stageName}
                      onChange={(e) => updateStage(i, { stageName: e.target.value })}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                      <input type="checkbox" checked={stage.isHrStage} onChange={(e) => updateStage(i, { isHrStage: e.target.checked })} />
                      Final HR stage
                    </label>
                    <button type="button" style={s.secondary} disabled={i === 0} onClick={() => moveStage(i, -1)}>↑</button>
                    <button type="button" style={s.secondary} disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)}>↓</button>
                    <button type="button" style={s.secondary} disabled={stages.length === 1} onClick={() => removeStage(i)}>Remove</button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      style={s.select}
                      value={stage.resolutionType}
                      onChange={(e) => updateStage(i, { resolutionType: e.target.value as ResolutionType, approverEmployeeId: null, approverRoleId: null })}
                    >
                      {(Object.keys(resolutionLabels) as ResolutionType[]).map((rt) => (
                        <option key={rt} value={rt}>{resolutionLabels[rt]}</option>
                      ))}
                    </select>

                    {stage.resolutionType === "SpecificEmployee" && (
                      <select style={s.select} value={stage.approverEmployeeId ?? ""} onChange={(e) => updateStage(i, { approverEmployeeId: e.target.value || null })}>
                        <option value="">— Select an employee —</option>
                        {employees.data?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                      </select>
                    )}
                    {stage.resolutionType === "RoleHolders" && (
                      <select style={s.select} value={stage.approverRoleId ?? ""} onChange={(e) => updateStage(i, { approverRoleId: e.target.value || null })}>
                        <option value="">— Select a role —</option>
                        {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" style={{ ...s.secondary, marginTop: 8 }} onClick={addStage}>+ Add stage</button>
          </div>

          {formError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{formError}</p>}

          <button style={s.addButton} disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
            Create chain
          </button>
        </div>
      </section>

      <section>
        <h2 style={s.sectionTitle}>Existing chains</h2>
        {chains.isLoading && <Spinner />}
        {chains.data?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No chains configured yet — every employee runs the default Manager → HR chain.
          </p>
        )}
        {chains.data && chains.data.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chains.data.map((chain) => (
              <div key={chain.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {chain.scopeType === "Global" ? "Global default" : `${chain.scopeType}: ${chain.scopeName ?? chain.scopeKey}`}
                    {!chain.isActive && <span style={{ color: "var(--muted)", fontWeight: 400 }}> — inactive</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={s.secondary} disabled={toggleActive.isPending} onClick={() => toggleActive.mutate(chain)}>
                      {chain.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button style={s.secondary} disabled={remove.isPending} onClick={() => remove.mutate(chain.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {chain.stages.map((st) => (
                    <li key={st.id} style={{ marginBottom: 4 }}>
                      <strong>{st.stageName}</strong>{st.isHrStage ? " (HR)" : ""} — {resolutionLabels[st.resolutionType]}
                      {st.approverEmployeeName ? `: ${st.approverEmployeeName}` : ""}
                      {st.approverRoleName ? `: ${st.approverRoleName}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

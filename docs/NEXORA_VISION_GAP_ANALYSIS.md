# NEXORA — Vision vs. Current State

**Scope:** a factual comparison between the long-term "Enterprise Operations Platform" architecture the user has specified (modular monolith, industry-agnostic core, event-driven, policy-configurable) and what actually exists in this codebase today (2026-09-09). This is not a plan and not a recommendation to rebuild anything — it's the honest baseline the phased roadmap in §61 of the vision should be measured against. Grounded in `backend/src/Erp.*`, `frontend/src/*`, and the existing docs (`README.md`, `FRONTEND_SPEC.md`, `PROJECT_ASSESSMENT.md`, `modules.md`) — not guessed.

---

## 1. One-line verdict

Nexora today is a well-built **HR/Payroll/Projects/Accounting ERP for a single kind of tenant** (a standard salaried-employee company), with genuinely solid multi-tenancy and a real (if narrow) approval-workflow engine. It is **not yet** the configurable, industry-agnostic platform the vision describes — non-login/hourly/vendor-billed workers, configurable policies, and a real workflow-configuration UI still don't exist. The frontend design system (colors, typography, spacing, unified nav) was brought in line with the vision's UX spec, and a first slice of the event/outbox infrastructure (§10–§12) now exists and is wired to two real events, both in this same session.

---

## 2. Already matches the vision

| Area | Where | Notes |
|---|---|---|
| Multi-tenant isolation | `Erp.Infrastructure` — `TenantEntity` base + global EF Core query filter, `JwtTenantContext` | Structural, not convention-based — a developer can't forget to scope a query. Matches §8 exactly. |
| Server-side authorization is authoritative | Every controller, `[RequirePermission(...)]` | Client-side `can()` checks are UX-only, backend re-checks always — matches §15/§26/§58 ("never let frontend decide authorization"). |
| Design tokens as single source of truth | `frontend/src/styles/tokens.css`, `pageKit.ts` | Rewritten this session to the exact palette/typography/spacing in §19–22. Semantic token names (`--text`, `--primary`, `--success`, `--radius-sm/md/lg`) added as aliases over the pre-existing names so nothing broke. No Tailwind/MUI — matches §33. |
| One unified navigation IA | `AppShell.tsx` — `NAV_MODULES` | Replaced four role-specific trees with one permission-gated tree this session, matching "configuration over special-casing" in spirit for the frontend layer specifically. |
| Collapsible/responsive nav shell | `AppShell.tsx` | Icon-rail collapse, off-canvas drawer under 760px — matches §34. |
| Audit logging exists for some flows | Login attempts, approvals, role changes | Real, not bolted on — but narrower than §25's full list (see below). |
| **Domain events + Outbox pattern (first slice)** | `Erp.Domain/Common/DomainEvent.cs`, `Erp.Infrastructure/Events/*` | `TenantEntity` can now raise events (`AddDomainEvent`); `ErpDbContext.SaveChanges` writes them into an `OutboxMessage` row in the *same* transaction as the business data; `OutboxDispatcherService` (a real `BackgroundService`, polling every 5s) dispatches them to DI-resolved `IDomainEventHandler<T>`s. Two real producers wired end-to-end: `ApprovalWorkflowService` raises `WorkflowApprovalCompletedEvent` on final-stage approval (shared by Leave/Reimbursement/ProjectExpense), `EmployeesController`/`UsersController` raise `EmployeeCreatedEvent` on hire. Each has one consumer (an idempotent audit-log handler) proving the pipeline is real and reusable across two separate modules, not a single-purpose hack. See §5 below — still a first slice, not the full picture. |

---

## 3. Partial — real mechanism, narrower than the vision

| Area | What exists | Gap to target |
|---|---|---|
| **Domain-oriented module structure** (§3) | `Erp.Domain` is already split into folders that roughly match business domains (`People`, `Timecard`, `Payroll`, `Project`, `Accounting`, `Workflow`) | `Erp.Application` is barely used (confirmed in `PROJECT_ASSESSMENT.md` and by direct inspection) — business logic lives in `Erp.Api` controllers, not behind module interfaces. No enforced boundary stops one "module" from touching another's tables directly; it just doesn't happen to yet. |
| **Person ≠ User ≠ Employee** (§4) | `AppUser` and `Employee` are already separate tables, linked by a **nullable** `AppUser.EmployeeId` — a non-login worker is technically representable today | No standalone `Person` concept. `Employee` conflates employment record + attendance eligibility + department/job-title linkage in one entity. `SalaryStructure` is keyed directly to `EmployeeId`, not a separable "compensation profile." Nothing in Attendance/Payroll is actually *built* around the no-login case as a first-class path — it's possible in the schema, unexercised in the product. |
| **Configurable workflow engine** (§14) | `ApprovalWorkflowService` — a real, generic, reused two-stage state machine shared by Leave/Reimbursement/Project Expense (`Erp.Infrastructure/Workflow`) | Stage chains are a **hard-coded static `Dictionary`** (`WorkflowDefinitions.cs`) — `LeaveRequest → [Manager, HR]` etc. Changing or adding a chain means a code change and redeploy, not tenant configuration. No conditional/branching routing (e.g. "Finance only if amount > X"), no N-stage dynamic chains. |
| **Scope-based RBAC** (§9) | `DataScopeService` + `PermissionScope` support `All / Mine / Department / Specific`, wired into most controllers — a real scope layer, not just flat roles | Only Department + ad-hoc record-list scoping exist. No Legal Entity, Region, Business Unit, Location, Cost Center, or Project scope types, and no scope hierarchy/inheritance across levels — flat, not the §9 hierarchy. |
| **Auditability** (§25) | Approvals, login attempts (success/fail/denied), role remaps are recorded, append-only | Not systematic across every entity change (§25's full list: employee changes, attendance corrections, payroll changes, configuration changes). No generic "who changed what, old value → new value" audit trail — each recorded event was hand-added per flow. |

---

## 4. Not present at all

| Area | Vision section | Evidence |
|---|---|---|
| Integration events (cross-process/external) | §10–11, §44 | The first-slice pipeline (§2 above) is domain events consumed *inside* this same process only — nothing publishes to anything external yet. Fine for now (there's nothing external to integrate with), but "integration event" as its own distinct concept doesn't exist. |
| Most business operations still run synchronously, not event-driven | §13 | Only two producers exist so far (workflow final-approval, employee creation). Payroll disbursement → journal posting (`IAccountingPostingService`) and most other cross-cutting side effects still happen synchronously in-request, not via the event pipeline. |
| Configurable policy objects | §16 | Zero classes matching `*Policy` (`AttendancePolicy`, `PayrollPolicy`, `LeavePolicy`, `ExpensePolicy`, `ApprovalPolicy`). LOP calculation, salary calc type, approval eligibility are all fixed in code. This is the natural next thing to build *on* the event pipeline — e.g. a `PolicyChanged` event invalidating cached policy reads — rather than bolting it on separately. |
| Non-login / hourly / daily / shift / vendor-billed workforce model | §5, §47, §48 | No `hourly`, `shift`, `contractor`, `vendor worker`, or `outsourced` concept anywhere. `SalaryStructure`/`SalaryComponent` only support fixed-amount or percentage-of-basic **monthly** components. `VendorBill` exists but is Accounts-Payable-only (paying an external company for goods/services), unrelated to billing for a worker's labor. |
| Multi-entity / multi-country / multi-currency org model | §7, §8 | Org model is flat: one tenant, no Legal Entity / Business Unit / Region / Country layer. Currency is a single tenant-level "base currency" (`lib/currency.ts` on the frontend), not per-entity. No timezone-awareness beyond server default. |
| Restaurant/outlet org model | §6 | No Brand/Outlet/Shift-schedule concept. `Department` is the only sub-org unit. |
| Procurement module | §3, Phase 6 | Does not exist — no Purchase Request/Order/Supplier/Goods Receipt entities or pages. |
| Inventory module | §3, Phase 6 | Does not exist — no Item/Stock/Warehouse/Inventory Transaction entities or pages. |
| Centralized notification infrastructure | §28 | `NotificationsBell.tsx` polls and shows transient toasts client-side (per `FRONTEND_SPEC.md` §8) — no backend event-driven notification dispatch, no email, no persisted inbox/read-state. |
| Document infrastructure as a reusable subsystem | §27 | Documents are handled per-module (`employee_docs`), not a shared metadata/ownership/versioning/access-control service reusable by Expense receipts, Payroll documents, Purchase Orders, etc. |
| Industry packs / module activation | §17, §50 | Every tenant sees the same fixed module set today — no capability flags, no "activate only what you need." |
| Observability infrastructure | §42 | No correlation IDs, no structured event-processing telemetry (there's nothing to instrument yet, since there's no event pipeline). Standard ASP.NET logging only. |
| Automated test coverage | §56 | **Zero** test projects, backend or frontend (confirmed in `PROJECT_ASSESSMENT.md §2.1`) — flagged there independently as the single highest-leverage gap regardless of this vision. |
| Database engine | §38 (states "prefer PostgreSQL") | Current stack is **SQL Server** (`README.md` — "SQL Server (Express) running locally"). This is a direct conflict with the vision doc's stated preference, not a gap in the "not built yet" sense — worth a deliberate decision, not a silent migration. |

---

## 5. Phase-by-phase status against §61's build order

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** — Platform Foundation (Tenant, Organization, Identity, Authorization, Users, People, Locations, Departments, Configuration, Audit, Event infra, Outbox) | Tenant/Identity/Authorization/Users/People/Departments exist and are solid. **Event infrastructure + Outbox** now exist (first slice, 2 producers/2 consumers, real background dispatcher). **Organization** (multi-entity) and **Configuration** (policy engine) still don't exist. | **~60% done** |
| **Phase 2** — Workforce (Employee/Worker, Employment, Attendance, Shift, Leave, Time Cards) | Employee/Attendance/Leave/Timecard exist and work. Worker-as-distinct-from-Employee, Shift scheduling, hourly/daily comp do not. | **~50% done** |
| **Phase 3** — Finance (Expenses, Reimbursements, Cost Centers, Basic Accounting) | Expenses/Reimbursements/Accounting (Chart of Accounts, Journal Entries, Ledger, Trial Balance, P&L, Balance Sheet, Cash Flow, AP/Vendor Bills) all exist and are fairly complete. Cost Centers are not a first-class allocable entity yet. | **~75% done** |
| **Phase 4** — Payroll (Compensation, Payroll Inputs, Calculation, Approval, Salary Release) | Exists end-to-end for salaried monthly employees. No hourly/shift/vendor compensation models. | **~60% done** |
| **Phase 5** — Work (Projects, Tasks, Time Tracking) | Exists and is fairly deep (planning, budget, profitability, cost tracking). | **~85% done** |
| **Phase 6** — Procurement + Inventory | Neither exists. | **0% done** |
| **Phase 7** — Reporting + Analytics | Team/Project/Expense/Financial reports exist as direct transactional queries; no read-model layer. | **~40% done** |
| **Phase 8** — Industry capabilities | None. | **0% done** |
| **Phase 9** — Enterprise capabilities (SSO, advanced audit, multi-country, advanced workflow, integrations) | None. | **0% done** |

---

## 6. What this means practically

The system is a real, working product for its current scope — it isn't fragile or poorly built (see `PROJECT_ASSESSMENT.md` §1 for what's specifically strong). The distance to the vision is concentrated in a small number of **foundational mechanisms that everything else would build on**: an event/outbox pipeline, a policy-configuration layer, and a proper Person/Worker/Employment split. Building the industry-specific surface (restaurant outlets, hourly pay, vendor billing) directly on top of today's `Employee`-centric model would mean special-casing exactly the way §16/§58 forbid; building it on the missing foundation first is what makes the rest of the vision achievable through configuration instead of branching code.

Not covered here: a proposed implementation plan for closing any of these gaps — that's a separate, scoped conversation per gap, not a single next action.

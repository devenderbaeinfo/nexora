# NEXORA ERP — Technical Architecture Document

**Status:** living document, reflects the codebase as of 2026-09-02 (backend `net10.0`,
frontend React 19 / Vite 8).

---

## 1. Stack Summary

| Layer | Technology |
|---|---|
| Backend runtime | .NET 10 (ASP.NET Core Web API) |
| ORM | Entity Framework Core 9, SQL Server provider |
| Database | SQL Server (Express supported), Windows-auth connection in dev |
| Auth | ASP.NET Core Identity (`IdentityCore<AppUser>`) + JWT bearer tokens |
| Frontend | React 19 + TypeScript, Vite 8 |
| Frontend routing | React Router 7 |
| Frontend server-state | TanStack (React) Query 5 |
| HTTP client | Axios |
| Linting | oxlint |
| Styling | Hand-written CSS design tokens (`tokens.css`), no CSS framework |

No test project exists on either side of the stack (see §8, Known Gaps).

## 2. Backend Layering

```
backend/src/
  Erp.Domain          — entities & enums, zero framework dependencies
  Erp.Application     — intended home for business-rule logic (still thin — most rule
                         logic lives in controllers/Infrastructure services; currently
                         holds IBillingProviderGateway, its first real content)
  Erp.Infrastructure   — EF Core DbContext, migrations, tenant scoping, the
                         approval-workflow engine, the accounting-posting service
  Erp.Api             — controllers, JWT issuance, permission policies, middleware, Program.cs
```

This is a standard four-layer split (domain → application → infrastructure → presentation), with
the caveat that `Erp.Application` is still thin in practice — most rule enforcement (who can
approve what, how a payroll run computes) lives directly in `Erp.Api` controllers or in
`Erp.Infrastructure` services (`ApprovalWorkflowService`, `AccountingPostingService`,
`DataScopeService`). Its first real content is `IBillingProviderGateway`/
`ManualBillingProviderGateway` — a seam for a future payment-processor integration (see §5.5) —
but the bulk of business logic is still an extraction target as controllers grow.

## 3. Multi-Tenancy Implementation

- Every tenant-owned entity inherits a common `TenantEntity` base (carries `TenantId` and
  `IsDeleted`).
- `ErpDbContext.OnModelCreating` applies **one global EF Core query filter**, by reflection, to
  every entity deriving from `TenantEntity`: `TenantId == _tenant.TenantId && !IsDeleted`. A
  developer cannot forget to scope a query — the scoping isn't something they write per-query.
- `_tenant` is `ITenantContext`, implemented by `JwtTenantContext` — it reads `TenantId` from the
  authenticated caller's own JWT claims. **`TenantId` is never accepted from client input** on a
  write; it is always re-stamped from the token.
- Cross-tenant reads (platform/admin surfaces, sync jobs) explicitly opt out via
  `.IgnoreQueryFilters()` and then filter deliberately — every such call site is a conscious
  exception, not the default.
- Soft-delete: `IsDeleted` flag, not a physical `DELETE`, for tenant-owned rows in normal
  application flow. (Hard deletes are performed only via direct, deliberate operator SQL for
  QA-tenant cleanup or orphan-data remediation — never through the application's own code paths.)

## 4. Domain Model Overview

`Erp.Domain` is organized by bounded context, one folder per module:

| Folder | Core entities |
|---|---|
| `Tenancy` | `Tenant` (incl. `BaseCurrencyCode`) |
| `Identity` | `AppUser`, `AppRole`, `Permission` (typed catalogue), `RoleTemplates`, `RolePermission`, `PermissionScope`, `PermissionScopeRecord`, `RoleFieldPermission` |
| `People` | `Employee`, `Department`, `JobTitle` |
| `Timecard` | `LeaveRequest`, `LeaveType` (incl. `IsPaidLeave`), `AttendanceEntry`, `Timesheet` |
| `Payroll` | `SalaryStructure`, `SalaryComponent` (Earning/Deduction, Fixed/% of Basic), `PayrollRun`, `Payslip`, `PayslipLine` |
| `Project` | `Project`, `ProjectMember` (role, cost rate/hr, bill rate/hr), `ProjectExpense`, `ProjectTask` |
| `Reimbursement` | `ReimbursementRequest` |
| `Onboarding` / `Offboarding` | onboarding checklist items, F&F case & clearance items |
| `Accounting` | `Account` (with `Currency`), `JournalEntry`, `JournalLine` (with `ExchangeRateToBase`), `ExchangeRate`, `Vendor`, `VendorBill` (Accounts Payable — see §5.5) |
| `Announcements` | `Announcement` |
| `Common` | shared base types (`TenantEntity`, audit stamps) |
| `Workflow` | `WorkflowInstance`, `WorkflowDecision` — the generic two-stage approval state; `TenantApprovalSettings` — the per-tenant fallback approver used when an employee has no `ReportingManagerId` |

Permissions are compile-time string constants (`Permission.cs`), grouped by module, discovered by
reflection into a `Catalog()` used both by the Roles admin UI and by server-side validation of
custom-role permission grants — a typo in a permission key fails at build time, not at runtime.

## 5. Shared Engines

### 5.1 Approval Workflow Engine (`Erp.Infrastructure/Workflow`)
One state machine (`ApprovalWorkflowService` / `WorkflowInstance` / `WorkflowDecision`), reused
by three flows instead of three hand-rolled copies:

| Flow | Stage 1 approver | Stage 2 approver |
|---|---|---|
| Leave | Submitter's reporting manager | HR |
| Reimbursement | Submitter's reporting manager | Finance |
| Project Expense | The **project's own** `ProjectManagerId` | Finance |

The engine owns generic state (whose turn it is, when it's finished); each controller owns its
own domain rule for *who* may act at a stage. Project Expense deliberately checks the project's
manager rather than the submitter's org-chart manager, proving the engine isn't secretly
leave-shaped. Adding a new two-stage approval flow means one entry in `WorkflowDefinitions` plus
a controller following the same shape — not a new state machine.

### 5.2 Accounting Posting Service (`Erp.Infrastructure/Accounting/AccountingPostingService.cs`)
`IAccountingPostingService` is the single chokepoint every module goes through to touch the
ledger — Payroll disbursement and Reimbursement/Project-Expense final approval both call
`FindOrCreateAccountAsync` + `PostAsync` rather than writing `JournalEntry`/`JournalLine` rows
directly. `PostAsync` enforces the same invariants a human entering a journal entry by hand would
have to satisfy:
- At least two non-zero lines.
- Each line is a debit **or** a credit, never both.
- Total debits == total credits (exactly — no floating rounding tolerance).

Auto-created accounts (e.g. "Salary Expense", "Employee Payable") are always created in the
tenant's own base currency — a category/liability account is never itself foreign-denominated,
only individual journal *lines* can be.

### 5.3 Multi-Currency Ledger
- Every `Account` carries a `Currency`. Every `JournalLine` carries an `ExchangeRateToBase`,
  **locked at posting time** — later corrections to the `ExchangeRate` table never retroactively
  re-value historical entries.
- `ExchangeRate` is a manually-maintained table (no live FX feed integration); rate lookup uses
  "the most recent rate on or before the entry date."
- Balance enforcement is in base-currency-equivalent terms: a line's native amount × its locked
  rate must sum to zero across the entry's debits/credits, not the raw native-currency amounts.
- Frontend mirrors this logic client-side (`JournalEntries.tsx`'s `latestRateFor`/`resolvedRate`)
  purely for live preview before submit — the backend is the actual source of truth and
  re-validates independently.

### 5.4 Data Scoping & Field Access (`Erp.Infrastructure/Authorization/DataScopeService.cs`)
A layer above the coarse `[RequirePermission]` check (see Security doc §3): `ResolveAsync`
answers "which specific records can this caller's role see for this permission," and
`FieldAccessAsync` answers "can this role see/edit this specific field on this resource." Absence
of a configured scope/field-permission row means fully unrestricted — existing tenants that never
configure this see no behavior change. Currently wired into `AuthController`, `ProjectsController`,
`EmployeesController`, `JobTitlesController`, `UsersController`, `PayrollController`, and
`AccountingController`. The `RolesController` endpoints backing the admin UI
(`Scopes`/`UpdateScope`/`FieldPermissions`/`UpdateFieldPermissions`) are resource-agnostic — they
drive entirely off `DataScopeCatalog`/`FieldPermissionCatalog`, so wiring a new permission/field
into those two catalogs is enough for the existing Roles page to expose it, with no new frontend
endpoint needed.

### 5.5 Accounts Payable (`VendorBillsController`)
Reuses `IAccountingPostingService` rather than introducing a second posting path: submitting a
bill just creates a `VendorBill` row (`Pending`); approving it posts Debit "{Category} Expense" /
Credit "Accounts Payable" (the account `AccountSync` already seeds as code `2000`); recording a
payment posts Debit "Accounts Payable" / Credit the tenant's cash account (same "no active
cash/bank account" guard `PayrollController.DisburseRun` already uses). No line-item invoice
model (`VendorBill` is a single amount + category, same shape as `ProjectExpense`/
`ReimbursementRequest`) and no customer-invoicing/receivables side — Accounts Payable only.

## 6. Persistence & Migrations

- EF Core Code-First migrations, generated via
  `dotnet ef migrations add <Name> --project src/Erp.Infrastructure --startup-project src/Erp.Api`.
- Migrations are applied automatically at API startup in Development
  (`await db.Database.MigrateAsync()` in `Program.cs`) — no manual migration step for local dev.
- New NOT NULL columns on existing tables sometimes need a **manual post-generation edit** to the
  generated migration file, since EF Core's inferred default (`""`, `0m`) doesn't always match
  the C# property initializer's intended default (e.g. `BaseCurrencyCode` should backfill
  existing tenants as `"INR"`, not `""`; `ExchangeRateToBase` should backfill as `1m`, not `0m`).
- Startup also runs three additive, idempotent sync jobs (Development only): `RolePermissionSync`
  (tops up newly added `Permission.*` values onto any role that hasn't been manually customized),
  `JobTitleSync`, and `AccountSync` (seeds a minimal starter Chart of Accounts per tenant, in that
  tenant's own base currency). `PlatformController.Create` also calls `JobTitleSync`/`AccountSync`
  directly right after provisioning a new tenant — previously a tenant created while the app was
  already running (i.e. every real one) sat with no default job titles or Chart of Accounts until
  the next deploy/restart; both jobs are safe to call mid-request since they're additive and
  re-scan every tenant regardless of caller.

## 7. Frontend Architecture

See `FRONTEND_SPEC.md` for full detail. Summary for cross-reference:
- All server state goes through TanStack Query — no separate global store for API data.
- Two module-level singletons carry cross-cutting values without prop-drilling or Context
  overhead: the JWT token (`lib/api.ts`) and the resolved base currency code (`lib/currency.ts`).
- `AppShell.tsx` renders a role-driven navigation tree (distinct module lists per role, e.g.
  `MANAGER_MODULES`, `FINANCE_MODULES`), not one static sidebar with client-side hiding.
- A generic `DataTable` component (search, sort, pagination, row-select, CSV export) is the
  standard list-rendering surface, first built for the People directory and intended to be the
  default for any future tabular page.

## 8. Known Gaps / Technical Debt

- **Zero automated test coverage** — no backend `*.Tests.csproj`, no frontend test runner
  configured. The approval state machines, tenant-isolation filter, and role-creation boundary
  checks are exactly the kind of logic this should cover first.
- **`Erp.Application` is still mostly unused** — `IBillingProviderGateway` is its first real
  content, but the bulk of business logic that should live there is still embedded in controllers
  and Infrastructure services. Not wrong for the project's current size, but a clear extraction
  target as controllers grow.
- **`FluentValidation.AspNetCore` is referenced in `Erp.Api.csproj` but has zero
  `AbstractValidator` implementations anywhere in the codebase** — validation today is entirely
  hand-written `if` checks in controllers, inconsistent in coverage (see Security doc).
- **Pagination is inconsistent** — six controllers apply some form of `Take`/limit
  (`AccountingController`, `SearchController`, `LeaveRequestsController`, `AuditLogController`,
  `TimesheetsController`, `AttendanceController`), but there is no shared `Skip`/`PageSize`
  pattern, and most list endpoints (Employees, Projects, Departments, Customers,
  Reimbursements) return their entire result set unbounded.
- **No structured logging or observability** — default ASP.NET Core console logging only; no
  correlation IDs, no per-tenant operational visibility.
- **No API documentation beyond raw OpenAPI JSON** — `AddOpenApi()`/`MapOpenApi()` is wired up
  (Development only, `/openapi/v1.json`), but there is no Swagger UI and no XML-doc enrichment.
- **No period-close mechanism in Accounting** — a journal entry can be posted to any date at any
  time; fine for a single concurrent user, a real risk once Finance has more than one operator.
- **Deployment/hosting/CI-CD is entirely out of scope of the current codebase** — there is no
  Dockerfile, no IaC, no CI pipeline definition checked in; this is a local-dev-only setup today.

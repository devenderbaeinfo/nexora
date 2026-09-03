# NEXORA ERP — Feature Ticket List

**Status:** living backlog, reflects the codebase as of 2026-09-03. `Done` tickets describe what
already shipped (kept here so the backlog reads as a complete product spec, not just open work);
`Backlog` tickets are unbuilt and unprioritized beyond the ordering within each epic.
Cross-referenced against `PRODUCT_REQUIREMENTS.md`, `TECHNICAL_ARCHITECTURE.md`, and
`SECURITY_AND_ACCESS.md` — read those first for the "why" behind any ticket here.

Legend: ✅ Done · ⚠️ Partial · ❌ Backlog

---

## Epic: PLT — Platform & Multi-Tenancy

| ID | Title | Status | Notes |
|---|---|---|---|
| PLT-1 | Tenant provisioning by SuperAdmin | ✅ | Workspace name/slug, first Admin, base currency, via `/admin/clients` → `PlatformController`. `JobTitleSync`/`AccountSync` now also run synchronously at provisioning time, so a new tenant has its default job titles and Chart of Accounts immediately — previously these only backfilled at the next app startup |
| PLT-2 | Structural tenant data isolation | ✅ | `TenantEntity` + global EF Core query filter, `TenantId` never trusted from client input |
| PLT-3 | Platform operator portal (`/admin`) | ✅ | Dashboard, analytics, clients, super-admins, plans, subscriptions, invoices, payments |
| PLT-4 | Per-tenant base currency | ✅ | Set at provisioning, drives all currency formatting and default account currency for that tenant |
| PLT-5 | Tenant plan/subscription billing logic | ⚠️ | Admin screens exist (`AdminPlans`, `AdminSubscriptions`, `AdminInvoices`, `AdminPayments`) but still read from mock data. A provider-agnostic seam now exists (`IBillingProviderGateway` / `ManualBillingProviderGateway` in `Erp.Application`, surfaced via a "Billing provider: Manual (not connected)" banner) so a real processor can be plugged in later without touching these pages — but no real processor is wired up and the pages don't yet persist real invoices/payments |
| PLT-6 | Tenant self-service deprovisioning / data export | ❌ | No "offboard a customer" or GDPR-style data export flow exists |

## Epic: IAM — Identity, RBAC & Access

| ID | Title | Status | Notes |
|---|---|---|---|
| IAM-1 | Six system roles with default permission templates | ✅ | `RoleTemplates.PermissionsFor` |
| IAM-2 | Typed, compile-time permission catalogue | ✅ | `Permission.cs`, reflection-based `Catalog()` |
| IAM-3 | `[RequirePermission]` endpoint authorization | ✅ | `PermissionPolicyProvider` + `PermissionAuthorizationHandler` |
| IAM-4 | Tenant Admin can create custom roles | ✅ | `RolesController.Create`, validated against `Permission.Catalog()` |
| IAM-5 | Tenant Admin can edit any role's permission set | ✅ | Sets `IsCustomized = true`, exempting it from future auto top-up |
| IAM-6 | Additive permission sync on new `Permission.*` values | ✅ | `RolePermissionSync`, skips customized roles |
| IAM-7 | Server-enforced "who can create whom" | ✅ | `RoleTemplates.AssignableRolesByCreatorRole` |
| IAM-8 | Record-level data scoping | ✅ | `DataScopeService.ResolveAsync` + `PermissionScope`/`PermissionScopeRecord`. The Manager system role's `project.view` now defaults to `Mine` out of the box (a new `DefaultDataScopeSync` job, additive/idempotent like `RolePermissionSync`, applied both at tenant provisioning and backfilled for existing tenants) — previously the "no row = unrestricted" default meant every manager could see every other manager's projects until an Admin manually scoped it |
| IAM-9 | Field-level view/edit access control | ✅ | `DataScopeService.FieldAccessAsync` + `RoleFieldPermission` |
| IAM-10 | Data scope / field access wired into Employees, Users, Job Titles, Projects, Auth | ✅ | |
| IAM-11 | Data scope / field access wired into Payroll & Accounting | ✅ | `Permission.Payroll.View`/`Permission.Accounting.View` added to `DataScopeCatalog`; Payroll scoping narrows a Manage/Approve holder to Department/Specific employees (never widens plain self-service `Payroll.View`), Accounting scoping restricts the Chart of Accounts/Ledger to specific accounts. `Payslip.GrossEarnings`/`NetPay` added to `FieldPermissionCatalog` (never hidden on a viewer's own payslip) |
| IAM-12 | Admin UI to configure data scopes / field access per role | ✅ | `RolesController`'s `Scopes`/`UpdateScope`/`FieldPermissions`/`UpdateFieldPermissions` endpoints were already generic — the Roles admin page's existing Data Scope/Field Access sections picked up Payroll/Accounting automatically; extended the "Specific" record picker to list Accounts (not employees) for `accounting.view` |
| IAM-13 | JWT signing key deployment checklist / verification | ✅ | Startup now also rejects the checked-in placeholder value or a key under 32 chars outside `Development`, not just a missing value |
| IAM-14 | Content-Security-Policy header | ✅ | Since the API never serves HTML, the CSP lives on the frontend's own document via a Vite `transformIndexHtml` plugin, build-only (`vite dev`'s Fast Refresh preamble is an inline script a strict CSP breaks) — see `vite.config.ts` |
| IAM-15 | Scope CORS to actual headers/methods used | ✅ | `WithHeaders("Content-Type", "Authorization").WithMethods("GET","POST","PUT","PATCH","DELETE")`, replacing `AllowAnyHeader().AllowAnyMethod()` |
| IAM-16 | Rate limiting beyond login/sensitive-action/search | ✅ | Global fixed-window limiter (300 req/min/IP) added as a catch-all beneath the existing named policies |

## Epic: PPL — People & Org

| ID | Title | Status | Notes |
|---|---|---|---|
| PPL-1 | Employee directory (create/edit/deactivate) | ✅ | `EmployeesController`, `People.tsx` via `DataTable` |
| PPL-2 | Departments & Job Titles management | ✅ | `DepartmentsController`, `JobTitlesController` — Job Titles now supports full CRUD (rename + role remap via one `PATCH`, plus `DELETE` blocked while any employee still holds the title), not just create. Its "grants role" dropdown now sources from a new `GET /job-titles/assignable-roles` (every role in the tenant, system or custom, so HR can label a title with a role Admin just created) instead of the narrower hiring-eligibility list — hiring privilege itself (`/users/assignable-roles`, `UsersController.Create`) is unchanged, so HR still can't hire into a title mapped to a role above their own reach |
| PPL-3 | Employee profile page with contextual actions | ✅ | `EmployeeProfile.tsx`, permission-gated actions (documents, salary, manager) |
| PPL-4 | Global search (employees, projects) | ✅ | `SearchController`, rate-limited |
| PPL-5 | Reusable `DataTable` (search/sort/paginate/select/export) | ✅ | `components/DataTable.tsx` |
| PPL-6 | Reporting-manager assignment | ✅ | Field on Employee, drives Leave approval routing |
| PPL-7 | Hard guard against creating a manager-less employee | ✅ | Both `/api/employees` and `/api/users` reject a null `ReportingManagerId` unless `AcknowledgeNoManager` is explicitly set; `AddPersonForm.tsx` replaced the silent dropdown option with a required checkbox |
| PPL-8 | Org chart visualization | ❌ | |
| PPL-9 | Bulk employee import (CSV) | ❌ | |
| PPL-10 | Defined leave-approval path for employees with no manager above them | ✅ | Resolved as a configurable per-tenant fallback approver: new `TenantApprovalSettings` + `ApprovalSettingsController`, an Admin picks the fallback approver on the Roles page, `LeaveRequestsController` routes a manager-less employee's request there |
| PPL-11 | Global search coverage extended to leave requests, expenses, job titles, announcements | ❌ | Currently Employees + Projects only |

## Epic: LVA — Leave & Attendance

| ID | Title | Status | Notes |
|---|---|---|---|
| LVA-1 | Leave submission | ✅ | |
| LVA-2 | Two-stage leave approval (Manager → HR) | ✅ | Via `ApprovalWorkflowService` |
| LVA-3 | Leave cancellation | ✅ | |
| LVA-4 | Leave type configuration (paid/unpaid) | ✅ | `LeaveType.IsPaidLeave` |
| LVA-5 | Leave balance tracking | ✅ | Debited only at final (HR) approval stage |
| LVA-6 | Approver review drawer (balance + history context) | ✅ | `LeaveReviewDrawer.tsx` |
| LVA-7 | Unpaid leave feeds Payroll LOP automatically | ✅ | Approved unpaid `LeaveRequest`s reduce that month's payslip |
| LVA-8 | Attendance clock in/out | ✅ | Regular-vs-overtime split now uses a per-tenant `TenantAttendanceSettings.StandardWorkDayHours` (default 8, Admin-editable on the Roles page) instead of a hardcoded 8-hour constant shared by every tenant |
| LVA-9 | Attendance views (personal / team / tenant-wide) | ✅ | |
| LVA-10 | HR attendance corrections | ✅ | `attendance.correct` |
| LVA-11 | Holiday calendar | ❌ | |
| LVA-12 | Automated monthly leave accrual | ❌ | Balances are set directly today, not accrued |
| LVA-13 | Notification on leave decision | ✅ | `NotificationsBell.tsx` now fires a transient toast for a newly-seen decision (tracked via `localStorage`, no new read/unread schema — reuses `NotificationsController`'s existing "recent, no read state" pattern) instead of only surfacing it in the bell panel |

## Epic: PAY — Payroll

| ID | Title | Status | Notes |
|---|---|---|---|
| PAY-1 | Per-employee salary structure (Additions/Deductions) | ✅ | Two-column HR entry form, live Gross/Deductions/Net preview |
| PAY-2 | Fixed-amount and % of Basic calculation types | ✅ | `SalaryCalculationType` |
| PAY-3 | Append-only salary structure history | ✅ | Old structure deactivated (`IsActive=false`), never overwritten |
| PAY-4 | Payroll run lifecycle (Draft → Approved → Disbursed) | ✅ | `PayrollController` |
| PAY-5 | LOP computed from approved unpaid leave | ✅ | |
| PAY-6 | Payslip generation with line-item breakdown | ✅ | `Payslip`/`PayslipLine` |
| PAY-7 | Self-service payslip viewing | ✅ | `MyPayslips.tsx` |
| PAY-8 | Payroll disbursement posts a balanced GL journal entry | ✅ | Via shared `IAccountingPostingService` |
| PAY-9 | Finance approval gate before disbursement | ✅ | `Permission.Payroll.Approve`, separate from HR's `Manage` |
| PAY-10 | Payslip PDF export | ❌ | |
| PAY-11 | Statutory form generation (Form 16, PF challans, etc.) | ❌ | |
| PAY-12 | Country-specific statutory tax-slab engine | ❌ | Deductions are generic line items today, not jurisdiction-aware tax computation |
| PAY-13 | Payroll data scoping (IAM-11 dependency) | ✅ | See IAM-11 |

## Epic: ONB — Onboarding, Documents & Offboarding

| ID | Title | Status | Notes |
|---|---|---|---|
| ONB-1 | New-hire onboarding checklist | ✅ | `Onboarding.tsx` / `OnboardingController` |
| ONB-2 | Employee document store (upload/verify/expire) | ✅ | `EmployeeDocumentsController`, restricted visibility (self + HR unless shared) |
| ONB-3 | Full & Final settlement checklist | ✅ | `FnfController`, clearances + final payout |
| ONB-4 | Document expiry notification | ❌ | |
| ONB-5 | E-signature integration for offer letters/contracts | ❌ | |
| ONB-6 | Bank details / emergency contacts in self-service profile | ❌ | `MyProfile.tsx` covers only basics today |

## Epic: PRJ — Projects

| ID | Title | Status | Notes |
|---|---|---|---|
| PRJ-1 | Project creation & budgeting | ✅ | |
| PRJ-2 | Project team staffing (role, cost rate/hr, bill rate/hr) | ✅ | `ProjectTeam.tsx`, basis for cost vs. billing math. `GET /projects/mine` ("My Projects") now also includes projects an employee manages (`ProjectManagerId`), not just ones they're staffed on as a `ProjectMember` — a manager who wasn't separately added as a team member used to be invisible in their own "My Projects" view |
| PRJ-3 | Task assignment | ✅ | |
| PRJ-4 | Project-scoped expense submission | ✅ | |
| PRJ-5 | Two-stage project expense approval (Project Manager → Finance) | ✅ | Uses the project's own `ProjectManagerId`, not the submitter's org-chart manager |
| PRJ-6 | Project expense approval posts a GL journal entry | ✅ | Same shared posting service as Payroll |
| PRJ-7 | Profitability / budget / cost / progress reporting | ✅ | `ProjectProfitability.tsx`, `ProjectBudget.tsx`, `ProjectCost.tsx`, `ProjectProgress.tsx`. Progress and Profitability now pick a project via the same clickable project-card grid as `ProjectTeam.tsx` (shared `projectCardGrid`/`projectCard` styles) instead of a `<select>` tucked in the top-right corner — click a card, manage/view below it |
| PRJ-8 | Task-assignment notification to assignee | ✅ | Same toast mechanism as LVA-13 — a new "task assigned to you" block in `NotificationsController`'s recent-items feed |
| PRJ-9 | Gantt/timeline view | ❌ | |
| PRJ-10 | Cross-project resource-utilization forecasting | ❌ | |

## Epic: EXP — Expenses & Reimbursement

| ID | Title | Status | Notes |
|---|---|---|---|
| EXP-1 | Personal reimbursement submission | ✅ | |
| EXP-2 | Two-stage approval (Manager → Finance) | ✅ | |
| EXP-3 | Final approval posts a balanced GL journal entry | ✅ | Debit "{Category} Expense" / Credit "Employee Payable" |
| EXP-4 | "Posted" status indicator on employee's own expense view | ✅ | `MyExpenses.tsx` teal badge when `journalEntryId` set |
| EXP-5 | Receipt attachment / OCR line-itemization | ❌ | |
| EXP-6 | Per-category spend policy enforcement (hard caps) | ❌ | |

## Epic: FIN — Accounting & Finance (incl. Multi-Currency)

| ID | Title | Status | Notes |
|---|---|---|---|
| FIN-1 | Chart of Accounts | ✅ | Per-tenant, starter accounts seeded via `AccountSync` |
| FIN-2 | Journal Entries (manual + system-posted) | ✅ | Balance-enforced via `IAccountingPostingService` |
| FIN-3 | Trial Balance / P&L / Balance Sheet / Cash Flow | ✅ | All derived from the same Journal Lines |
| FIN-4 | Per-account currency | ✅ | `Account.Currency` |
| FIN-5 | Per-line exchange rate, locked at posting time | ✅ | `JournalLine.ExchangeRateToBase` |
| FIN-6 | Manual exchange rate maintenance ("most recent rate on/before date") | ✅ | `ExchangeRates.tsx`, `ExchangeRate` table |
| FIN-7 | Base-currency-equivalent balance enforcement | ✅ | Backend authoritative; frontend mirrors for live preview |
| FIN-8 | Shared posting chokepoint used by Payroll & Reimbursement/Project Expense | ✅ | `IAccountingPostingService` |
| FIN-9 | Live FX rate feed integration | ❌ | Rates are entered manually today |
| FIN-10 | Accounts Payable / Accounts Receivable vendor-bill workflow | ⚠️ | **AP built**, AR not: new `Vendor`/`VendorBill` entities, `VendorBillsController` (submit → approve, posting Debit "{Category} Expense" / Credit "Accounts Payable" → pay, posting Debit "Accounts Payable" / Credit Cash — both through the existing `IAccountingPostingService`), `VendorBills.tsx` page linked from the Accounting hub. No customer-invoicing/receivables side yet |
| FIN-11 | Tax reporting (GST/VAT returns) | ❌ | |
| FIN-12 | Period close / lock mechanism | ❌ | A journal entry can be posted to any date at any time — real risk with concurrent Finance users |
| FIN-13 | Accounting data scoping (IAM-11 dependency) | ✅ | See IAM-11 |

## Epic: ANN — Announcements

| ID | Title | Status | Notes |
|---|---|---|---|
| ANN-1 | Tenant-wide announcements, HR-writable / everyone-readable | ✅ | |
| ANN-2 | Policy document attachments on announcements | ❌ | |

## Epic: RPT — Reporting & Dashboards

| ID | Title | Status | Notes |
|---|---|---|---|
| RPT-1 | Role-specific dashboards (Dashboard, FinanceDashboard) | ✅ | |
| RPT-2 | Team / project / expense report suites | ✅ | `TeamReports.tsx`, `ProjectReports.tsx`, `ExpenseReports.tsx`, `FinanceExpenseReports.tsx` |
| RPT-3 | Audit log viewer | ✅ | `AuditLog.tsx`, capped at 500 rows, no offset pagination |
| RPT-4 | Platform-wide analytics (`/admin/analytics`) | ✅ | |
| RPT-5 | Exportable/scheduled report delivery (email/PDF) | ❌ | Reports are in-app view only today |

## Epic: HRD — Platform Hardening (cross-cutting, no dedicated module)

| ID | Title | Status | Notes |
|---|---|---|---|
| HRD-1 | Backend test project (approval state machines, tenant isolation, role-creation boundaries) | ❌ | Zero automated backend tests exist |
| HRD-2 | Frontend test suite (critical forms + approval flows) | ❌ | Zero automated frontend tests exist; no test runner configured |
| HRD-3 | Consistent pagination pattern (`Skip`/`PageSize`) across all list endpoints | ❌ | Only 6 controllers apply any limiting today; most are unbounded |
| HRD-4 | `FluentValidation` validators for high-risk write endpoints | ❌ | Package is installed, zero validators implemented |
| HRD-5 | Structured logging + correlation IDs | ❌ | Default console logging only, no per-tenant operational visibility |
| HRD-6 | Swagger UI + endpoint documentation | ❌ | Raw OpenAPI JSON exists (dev-only); no browsable docs |
| HRD-7 | Extract business-rule logic from controllers into `Erp.Application` | ❌ | Layer exists but is effectively empty; logic currently lives in `Erp.Api`/`Erp.Infrastructure` |
| HRD-8 | Shared frontend loading/error-state hook, applied to all pages | ❌ | Roughly half of sampled pages silently fail on API error today |
| HRD-9 | Accessibility pass (aria-labels on icon-only buttons, explicit label associations) | ❌ | Only 2 page files reference `aria-*` attributes today |
| HRD-10 | In-app notification center beyond pending approvals | ❌ | No "this happened to something you own" notification path exists anywhere |
| HRD-11 | CI pipeline + deployment/IaC definition | ❌ | Local-dev-only setup today; no Dockerfile/CI config checked in |

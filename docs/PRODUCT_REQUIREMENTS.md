# NEXORA ERP — Product Requirements Document

**Status:** living document, reflects the codebase as of 2026-09-02.
**Audience:** product, engineering, and anyone onboarding onto the project.

---

## 1. Vision & Positioning

NEXORA is a multi-tenant ERP covering HR, Payroll, Projects, and Finance for small-to-mid-size
services companies. Per the original charter (`README.md`): built to run **internally first**
(Stage 1 — BAE's own operations), then sold as a **multi-tenant SaaS product** (Stage 2). The
architecture already assumes Stage 2 (tenant isolation, a platform/operator layer separate from
customer tenants, per-tenant role customization) even while Stage 1 is the current reality.

**Core bet:** one system spanning People, Time, Payroll, Projects, and Accounting so that data
entered once (an employee's salary structure, a project's budget, an approved leave request)
flows through to every downstream number (a payslip, a burn-rate report, a P&L) without manual
reconciliation between disconnected tools.

## 2. Users & Roles

NEXORA ships six system roles, each with a default permission template (`RoleTemplates.cs`) that
a tenant's own Admin can further customize (see §6, RBAC). A tenant may also define entirely
custom roles.

| Role | Who they are | What they primarily do |
|---|---|---|
| **SuperAdmin** | BAE's own platform operators (reserved `platform` tenant only) | Provision new client tenants and their first Admin; platform-wide billing/plan administration |
| **Admin** | The customer's own org owner/IT admin | Create HR/Manager/Finance/Employee accounts, manage org structure, customize roles & permissions, view audit log |
| **HR** | HR staff | Manage the employee lifecycle end-to-end: people records, onboarding, leave policy & final approval, attendance oversight, documents, F&F, payroll processing, announcements |
| **Manager** | People managers / project leads | First-stage approval on direct reports' leave & expenses, approve project expenses for projects they manage, timesheet approval, team visibility |
| **Finance** | Finance/accounts staff | Final approval on reimbursements & project expenses, own the Chart of Accounts and journal entries, approve & disburse payroll runs |
| **Employee** | Everyone else | Self-service: submit leave/timesheets/expenses, view own payslips, view own documents, see own project assignments |

Every login resolves the caller's *effective* role live from `Employee → JobTitle → SystemRole`
at auth time (not cached at account creation), so a promotion or department move takes effect on
the next login without a data-migration step.

## 3. Multi-Tenancy Model

- Each customer is a **Tenant**, fully data-isolated from every other tenant at the database
  query layer (see Technical Architecture doc for mechanism).
- A tenant is provisioned by a SuperAdmin with: workspace name, a URL-safe **workspace slug**
  (used historically for tenant identification; login today is by email alone, globally unique),
  a first Admin account, and a **base currency** (e.g. INR, USD) that all of that tenant's
  accounting and payroll figures are denominated in.
- Nothing in a tenant's own data (roles, employees, projects, ledger) is visible to, or
  modifiable by, another tenant — enforced structurally, not by convention (see Security doc).

## 4. Modules

Status legend: ✅ Built and in active use · ⚠️ Partial · ❌ Not built (backlog)

### 4.1 People & Org (✅)
- Employee directory: create/edit/deactivate, department, job title, reporting manager.
- Org structure: Departments, Job Titles (each mapped to a system role).
- Employee profile page with contextual actions (documents, salary structure, manager, etc.)
  gated per-permission.
- Global search across employees and projects.
- Creating a person without a reporting manager now requires an explicit acknowledgment
  ("this person has no manager — top of the org chart") rather than silently allowing it — a
  blocking guard, not just a warning.
- **Gap:** no bulk-import, no org chart visualization.

### 4.2 Identity, Roles & Access (✅)
- Six system roles with sensible default permissions, customizable per tenant.
- Tenant Admins can create **entirely custom roles** with an arbitrary permission set, chosen
  from the full permission catalogue.
- Record-level **data scoping** and field-level **field access control** exist as a layer above
  the coarse "can call this endpoint" permission check, applied to Employees, Users, Job Titles,
  Projects, Auth, **and now Payroll and Accounting** — letting a tenant restrict a role to
  specific records (e.g. a department's payslips, a specific set of ledger accounts) or
  view/hide specific fields (e.g. compensation amounts on someone else's payslip) without
  writing code. Payroll scoping only ever narrows an already-broad Manage/Approve role; it can
  never widen a plain Employee's self-service-only payslip access.
- The Roles admin page's Data Scope / Field Access sections are driven generically off the
  permission/field catalogues, so they picked up Payroll and Accounting automatically once those
  were added — no separate UI build was needed per module.

### 4.3 Leave & Attendance (✅)
- Leave: submit, two-stage approval (Employee → Manager → HR), cancellation, leave-type
  configuration (paid/unpaid), balance tracking, review drawer with balance + history context
  for the approver.
- Attendance: clock in/out, personal/team/tenant-wide views, HR corrections.
- Leave feeds Payroll's Loss-of-Pay (LOP) calculation directly — an approved unpaid leave day
  reduces that month's payslip automatically.
- An employee's leave decision (approved/rejected) now surfaces as a toast notification, not
  just something visible if they happen to check the notifications bell.
- A tenant can configure a per-tenant **fallback approver** (Roles page) who covers leave
  approval for anyone with no `ReportingManagerId` — resolves what was previously an unresolved
  org-design question (who approves leave for the top of the org chart, or HR itself).
- **Gap:** no holiday calendar, no leave-accrual automation (balances are set, not accrued
  monthly).

### 4.4 Payroll (✅)
- Per-employee **salary structure**: Additions (earnings — basic, HRA, allowances, etc.) and
  Deductions (PF, gratuity, professional tax, etc.) as two explicit columns, entered by HR,
  with `FixedAmount` or `% of Basic` calculation per line and a live Gross/Deductions/Net
  preview before saving.
- **Payroll run** lifecycle: Draft (auto-computed from salary structures + that month's approved
  unpaid leave) → Approved (Finance) → Disbursed (posts a balanced journal entry to Accounting).
- **Payslips**: per-employee line-item breakdown, self-service viewing (My Payslips) and
  HR/Finance drill-down (Payroll Run detail).
- History is append-only — changing an employee's salary deactivates the old structure rather
  than overwriting it, so past payslips remain traceable to the structure that produced them.
- **Gap:** no payslip PDF export, no statutory-form generation (Form 16, PF challans, etc.), no
  multi-country tax-slab engine (deductions are modeled generically, not India-specific
  statutory logic).

### 4.5 Onboarding, Employee Documents & Full-and-Final Settlement (✅)
- Onboarding: per-new-hire checklist, HR-tracked completion.
- Employee Documents: per-employee document store (offer letters, ID proofs, contracts),
  upload/verify/expire, visibility restricted to the employee + HR unless explicitly shared.
- F&F: exit checklist (clearances, asset return, final payout), HR-initiated and tracked to
  close-out.
- **Gap:** no e-signature integration, no automated document-expiry notification.

### 4.6 Projects (✅)
- Project creation, budgeting, team staffing (role on project, cost rate/hr, bill rate/hr per
  team member — the basis for project cost vs. billing math), task assignment.
- Project-scoped expense submission with its own two-stage approval (Employee → the *project's*
  Project Manager → Finance) — deliberately distinct from an employee's org-chart manager.
- Profitability, budget, cost, and progress reporting per project.
- Assigning someone a task now surfaces as a toast notification to the assignee — previously a
  completed half-feature (assignment worked, the assignee had no way to notice).
- **Gap:** no Gantt/timeline view, no resource-utilization forecasting across projects.

### 4.7 Expenses & Reimbursement (✅)
- Personal reimbursement claims: two-stage approval (Employee → Manager → Finance).
- On final Finance approval, a balanced journal entry posts automatically (Debit "{Category}
  Expense", Credit "Employee Payable") — reimbursement and project-expense approval both feed
  the real ledger, not a disconnected spreadsheet.
- **Gap:** no receipt OCR/line-item itemization, no per-category spend policy enforcement
  (e.g. a hard cap per category).

### 4.8 Accounting & Finance, incl. Multi-Currency (✅)
- Double-entry core: Chart of Accounts, Journal Entries, and derived Trial Balance / P&L /
  Balance Sheet / Cash Flow — all computed from the same Journal Lines, not separately
  maintained.
- **Multi-currency ledger**: every account has a currency; a journal line not in the tenant's
  base currency locks in an exchange rate at posting time (`ExchangeRateToBase`); entries
  balance in base-currency-equivalent terms. Exchange rates are manually maintained per
  currency pair per date (no live FX feed) — this covers the real driver case (a USD SaaS
  subscription paid but recorded/deducted in INR).
- Payroll disbursement, Reimbursement/Project-Expense final approval, **and now Accounts
  Payable** (vendor bill approval and payment) all post through the same shared,
  balance-enforcing posting primitive (`IAccountingPostingService`), so a system-generated entry
  is indistinguishable from one Finance enters by hand.
- **Accounts Payable**: vendors, vendor bills (submit → Finance approve, which posts the expense
  and liability → record payment, which clears the liability against cash), on the Accounting
  hub's "Vendor Bills" page. No customer-invoicing/Accounts Receivable side yet.
- **Gap:** no Accounts Receivable/customer-invoicing workflow, no tax reporting (GST/VAT
  returns), no period-close/lock mechanism (a journal entry can be posted to any date at any
  time — fine today, a real risk once more than one person enters data concurrently).

### 4.9 Announcements (✅)
- Tenant-wide announcements/policy postings, HR-writable, everyone-readable.

### 4.10 Platform / Admin Portal (✅, separate from the tenant app)
- Under `/admin`: tenant (client) provisioning, plans, subscriptions, invoices, payments,
  platform-wide analytics — the SuperAdmin's own surface, structurally separate from any
  customer tenant's own app.

### 4.11 Explicitly Not Built (backlog, called out for honesty, not oversight)
- **Recruiting / Job Postings & candidate pipeline.**
- **Performance review cycles.**
- **POSH training compliance tracking.**
- **A full in-app notification center beyond pending-approvals.** A leave decision and a task
  assignment now surface as toast notifications (reusing the existing pending-approvals poll, no
  new read/unread schema), but there's still no persisted notification history/inbox, and a
  document expiring still has no notification path at all.
- **Bank details / emergency contacts** in employee self-service (My Profile covers only basics).

## 5. Non-Functional Requirements

- **Tenant isolation is structural**, not a coding convention a developer can forget.
- **Permissions are granular and auditable** — every sensitive action traces to a named
  `permission.key`, not an implicit role check buried in a controller.
- **Every approval, denied-access attempt, password reset, and role change is audit-logged**,
  append-only.
- **Currency correctness**: a multi-currency entry must balance in base-currency-equivalent
  terms; the exchange rate used is locked at posting time so historical entries never silently
  re-value when a rate is later corrected.
- **No fabricated data**: payroll/compensation figures for real employees are only ever entered
  from a real source (HR-provided CTC), never estimated or guessed by the system or its
  operators.

## 6. Known Gaps at the Platform Level

(Cross-references the Technical Architecture and Security docs, listed here for product
visibility.) No automated test coverage anywhere in the codebase; no structured
logging/observability; pagination exists on some list endpoints but is not a universal pattern;
input validation is hand-written per-controller rather than a consistent validation layer; no
persisted in-app notification history/inbox (toast notifications now cover leave decisions and
task assignments, but there's no read/unread record of past notifications). None of these block
the current feature
set from working correctly today — they are the gap between "the product works" and
"the product is hardened for scale," and are tracked as backlog items in the Feature Ticket List.

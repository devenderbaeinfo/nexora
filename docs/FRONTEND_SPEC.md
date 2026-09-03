# NEXORA ERP — Frontend Specific Document

**Status:** living document, reflects the codebase as of 2026-09-02.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | React Router 7 (`Routes`/`Route`, client-side only) |
| Server state | TanStack Query 5 (`@tanstack/react-query`) — no Redux/global store for API data |
| HTTP client | Axios, one shared instance (`lib/api.ts`) |
| Styling | Hand-authored CSS custom-property design system (`styles/tokens.css`) — no Tailwind/MUI/CSS-in-JS |
| Linting | oxlint |

There is no component test runner and no Storybook — component behavior is currently verified by
manual/Playwright-driven browser testing only (see Technical Architecture doc §8).

A custom Vite plugin (`vite.config.ts`) injects a `Content-Security-Policy` `<meta>` tag into
`index.html` on `vite build` only (never `vite dev`, since the dev server's Fast Refresh preamble
is an inline script a strict CSP would block) — see Security doc §7.

## 2. Design System

- One token system, **two themes** (light: purple-on-white; dark: deep navy with a restrained
  purple glow), toggled from the top bar and persisted per-browser.
- Typography: **Playfair Display** for major headings, **Inter** everywhere else.
- Shared style objects (e.g. `formStyles`) rather than a component library — forms compose
  `s.label`, `s.field`, `s.button`, `s.error`, `s.actions` etc. for visual consistency without a
  heavyweight UI kit.

## 3. Application Shell & Navigation

`components/AppShell.tsx` renders **role-driven navigation**, not one static sidebar with
client-side hiding of irrelevant links. Distinct module trees exist per role context, e.g.
`MANAGER_MODULES`, `FINANCE_MODULES`, `EMPLOYEE_MODULES`, `DEFAULT_MODULES` — each an array of
`NavModule` objects (a top-level module with a `label`, a `to`/`landingTo` route, and a list of
`sections` for nested links). A module with no direct route renders as an accordion `<button>`
that expands to reveal its sections; a module with a direct route renders as a plain link.

This means the nav a given user sees is assembled from **what their role can reach**, not from
one shared tree with items conditionally hidden — adding a new role-specific landing page means
adding an entry to that role's own module array.

## 4. Routing Table

Two top-level route trees, plus a bare login route:

### `/` — the tenant application shell (role-gated per-page via `useAuth().can()`)

| Route | Page | Module |
|---|---|---|
| `/` (index) | `People` | People |
| `/people` | `PeopleOverview` | People |
| `/people/:employeeId` | `EmployeeProfile` | People |
| `/dashboard` | `Dashboard` | Dashboard |
| `/my-team` | `MyTeam` | People |
| `/job-titles` | `JobTitles` | Admin |
| `/roles` | `Roles` | Admin (RBAC) |
| `/audit-log` | `AuditLog` | Admin |
| `/leave-types` | `LeaveTypes` | Leave config |
| `/timecard` | `Timecard` | Time |
| `/attendance` | `Attendance` | Time |
| `/my-time` | `Attendance` (personalOnly) | Time |
| `/timesheets/approval` | `TimesheetApproval` | Time |
| `/payroll/runs`, `/payroll/runs/:runId` | `PayrollRuns`, `PayrollRunDetail` | Payroll |
| `/my-payslips` | `MyPayslips` | Payroll (self-service) |
| `/reimbursement` | `Reimbursement` | Expenses |
| `/my-expenses` | `MyExpenses` | Expenses |
| `/expenses/team`, `/expenses/approvals` | `MyTeamExpenses`, `ExpenseApprovals` | Expenses |
| `/approvals` | `MyApprovals` | Cross-module approval inbox |
| `/projects*` (`create`, `planning`, `team`, `tasks`, `mine`, `progress`, `budget`, `profitability`, `cost`, `expenses`) | Project suite | Projects |
| `/finance/dashboard`, `/finance/projects` | Finance views | Finance |
| `/accounting`, `/accounting/chart-of-accounts`, `/accounting/exchange-rates`, `/accounting/journal-entries`, `/accounting/ledger`, `/accounting/bank-cash`, `/accounting/trial-balance`, `/accounting/profit-and-loss`, `/accounting/balance-sheet`, `/accounting/cash-flow` | Accounting suite | Finance |
| `/vendor-bills` | `VendorBills` (Accounts Payable — vendors, bill approval, payments) | Finance, linked from the Accounting hub, gated by `accounts_payable.view` |
| `/reports*` (`overview`, `team`, `projects`, `expenses`, `expenses-all`) | Reporting suite | Reports |
| `/onboarding` | `Onboarding` | HR |
| `/documents` | `EmployeeDocuments` | HR |
| `/fnf` | `FnfSettlement` | HR |
| `/announcements` | `Announcements` | Cross-cutting |
| `/my-profile` | `MyProfile` | Self-service |

### `/admin` — the platform operator portal (SuperAdmin only, structurally separate app section)

| Route | Page |
|---|---|
| `/admin/dashboard` | `AdminDashboard` |
| `/admin/analytics` | `AdminAnalytics` |
| `/admin/clients` | `AdminClients` |
| `/admin/super-admins` | `AdminSuperAdmins` |
| `/admin/plans` | `AdminPlans` |
| `/admin/subscriptions` | `AdminSubscriptions` |
| `/admin/invoices` | `AdminInvoices` |
| `/admin/payments` | `AdminPayments` |

### `/login`
Bare login page, outside both shells.

## 5. State Management Patterns

- **Server state**: every data fetch/mutation goes through TanStack Query — no manual
  `useEffect` + `fetch` + local-state-cache pattern anywhere new should be introduced; existing
  pages consistently use `useQuery`/`useMutation` with `queryClient.invalidateQueries` on
  success.
- **Cross-cutting client state uses module-level singletons, not React Context**, for the two
  values needed almost everywhere and rarely changed:
  - **Auth token** (`lib/api.ts`): held in a plain module-level `let accessToken`, **not**
    `localStorage` — deliberately, so an XSS payload executing on the page cannot read it via
    the standard `localStorage` API; it only exists in a closure Axios's interceptor reads.
    A `401` response clears the token and dispatches a global `erp:session-expired` event that
    `AuthContext` listens for to force a re-login.
  - **Base currency code** (`lib/currency.ts`): set once at login/password-change, read by
    `formatCurrency()` everywhere a monetary value is rendered, so every page formats money in
    the tenant's own base currency without threading it through props.
  This avoids prop-drilling and Context re-render overhead for values that are read constantly
  but almost never change within a session.
- **`AuthContext`** wraps the app for actual auth *lifecycle* (login, forced password change,
  logout, session-expired handling) — a normal React Context, used because that state genuinely
  needs to trigger a re-render of the shell (e.g. switching from the login screen to the app).

## 6. Permission-Aware UI

- `useAuth().can(permissionKey)` gates rendering of buttons/sections/entire pages client-side —
  e.g. the "Add document" action on `EmployeeProfile` only renders if the caller has
  `employee_docs.manage`.
- **This is a UX convenience, not the security boundary** — the same permission is always
  re-checked server-side via `[RequirePermission(...)]`; hiding a button client-side prevents a
  confusing "403" experience, it does not substitute for backend enforcement (see Security doc).

## 7. Reusable Components

- **`DataTable<T>`** (`components/DataTable.tsx`) — the standard list-rendering surface: search,
  sortable column headers, pagination footer (when the row count justifies it), optional
  row-selection with bulk actions, CSV export. Built first for the People directory
  (`People.tsx`), intended as the default going forward rather than hand-rolling a new
  `<table>` per page.
- **`formStyles`** — shared style tokens for form layout (labels, fields, buttons, error
  banners, action rows), used across every create/edit form (Add Person, Submit Leave, Set
  Salary Structure, New Client, etc.) for visual consistency.
- Multi-column salary structure form (`SetSalaryStructureForm.tsx`) — a notable non-generic
  form worth knowing about: renders **Additions** and **Deductions** as two explicit columns
  (via a shared `ComponentColumn` sub-component) with a live-computed Gross/Deductions/Net
  preview as HR types, before the structure is saved.

## 8. Known Frontend Gaps

- **Inconsistent loading/error states.** Roughly half of sampled pages (`People`, `AuditLog`)
  show a proper loading skeleton and a user-facing error message on API failure; others
  (`Timecard`, `MyApprovals`, `FinanceDashboard`, `ProjectBudget`) render nothing on failure —
  the page just appears broken with no explanation. This should become a shared hook
  (e.g. wrapping `useQuery`'s `isLoading`/`isError`), not a per-page decision.
- **Accessibility is inconsistent.** Interactive elements are consistently real `<button>`
  elements (not `<div onClick>`) — the right instinct — but explicit `aria-label`s on
  icon-only buttons and explicit `<label htmlFor>` associations are rare; only a couple of page
  files reference `aria-*` attributes at all, against 75+ files using `onClick`.
- **No component or end-to-end test suite** — `npm run lint` (oxlint) and `tsc -b` are the only
  automated checks; feature verification is done by manually driving a running dev stack
  (optionally via Playwright ad hoc), not by a committed test suite.
- **No persisted notification inbox** — `NotificationsBell.tsx` now also fires a transient toast
  the moment a poll turns up a new leave decision or task assignment (deduped via a
  `localStorage`-tracked "seen" set, not a backend read/unread schema), but there's still no
  history view and a document expiring still has no notification path at all.

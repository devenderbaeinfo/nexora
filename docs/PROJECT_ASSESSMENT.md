# Meridian ERP — Internal Engineering Assessment

**Scope:** an honest internal read of where this system actually stands — what's solid, what's missing, what's fragile, and what it would take to call this "production-grade, fully professional" rather than "a well-built demo." Deployment, hosting, and cloud infrastructure are explicitly out of scope; this is about the code, the data model, and the workflows themselves.

---

## 1. Where this is genuinely strong

Worth stating plainly before the gap list, because the architecture underneath is sound and shouldn't get lost:

- **Multi-tenancy is structurally enforced, not convention-based.** Every tenant-owned entity inherits `TenantEntity`, and `ErpDbContext` applies one global query filter (`TenantId` match + not soft-deleted) generically for all of them — a developer cannot forget to scope a query, because the scoping isn't something they write. Confirmed consistent across every `DbSet` in the context.
- **Permission model is a real, typed catalogue** (`Permission.cs`), not stringly-typed magic scattered through the app — a typo in a permission key fails at compile time, not at 2am in production.
- **Role resolution is live, not cached.** A person's system role is resolved from `Employee → JobTitle → SystemRole` at every login (`EffectiveRoleResolver`), which was a real architectural fix made mid-project after discovering role snapshots drifted from reality.
- **The two-stage approval engine** (`ApprovalWorkflowService`) is shared cleanly across Leave, Reimbursement, and Project Expense — one state machine, not three hand-rolled copies, and it structurally guarantees a first-stage approver can never finalize something only HR/Finance should.
- **Audit logging exists and is genuinely used** — approvals, denied access attempts, password resets, and role remaps are recorded, not bolted on as an afterthought.
- Password policy, login rate limiting, lockout, and a non-hardcoded JWT signing key are all in place and reasonably strict for a system this size.

This is not a system built carelessly. The gaps below are mostly about what wasn't built yet, and about the operational discipline needed to run this for real — not about the foundation being wrong.

---

## 2. Critical gaps (block calling this "production-ready")

### 2.1 Zero automated test coverage
There is no test project anywhere — no `*.Tests.csproj` on the backend, no test runner configured on the frontend. **0% coverage.** For a system encoding this much business logic (two-stage approvals, balance debiting, tenant isolation, role resolution), every regression is currently caught only by a human clicking through the UI — which is exactly how the reporting-manager bug, the year-mismatch balance bug, and the HR-approval-status default bug in this session were found: by accident, in production-adjacent testing, not by a test suite.

**This is the single highest-leverage thing to fix.** At minimum:
- Backend: a test project covering the approval state machines (Leave/Reimbursement/Project Expense), the permission-boundary checks in `UsersController`/`JobTitlesController` (who can create whom), and the tenant-isolation query filter itself.
- Frontend: component tests for the approval review flows and at least smoke tests for the critical forms (Add Person, Submit Leave).

### 2.2 No global exception handling
`Program.cs` has no `UseExceptionHandler` and no custom `IExceptionHandler`. An unhandled exception anywhere in the API currently falls through to the ASP.NET Core framework default — which in Development shows a full stack trace, and in Production has no deliberate "don't leak internals" strategy at all. This needs:
- A global exception middleware that logs the real exception server-side and returns a sanitized, consistent error shape to the client.
- A decision on whether that shape is `ProblemDetails` (the .NET-idiomatic choice) applied consistently, since right now error responses are whatever each controller's ad-hoc `BadRequest("...")` string happens to say.

### 2.3 No pagination anywhere
Every list endpoint — Employees, Projects, Departments, Customers, Reimbursements — returns its entire result set unbounded. The only two endpoints with any cap at all are the Audit Log (`.Take(500)`, no offset) and a 5-row "recent history" preview on leave review. This works fine at 7 employees and 3 tenants. It will not work at 500 employees. There is no `Skip`/`PageSize` pattern anywhere in the codebase to build on — this needs to be designed once and applied consistently, not patched endpoint by endpoint later.

### 2.4 Input validation is manual, inconsistent, and has real holes
No FluentValidation, no DataAnnotations — every validation check is a hand-written `if` in the controller, and coverage varies by author mood rather than by risk:
- `ProjectExpensesController.Submit` checks amount and project existence but never validates `Category` beyond non-empty, and doesn't validate `IncurredOn` isn't in the future or absurdly old.
- `CustomersController` and `DepartmentsController` only check that `Name` isn't blank — no length caps, meaning a 50,000-character department name is currently accepted.
- Several read-heavy controllers have zero request validation at all (expected for pure reads, but worth confirming nothing there is actually a write in disguise).

This isn't about paranoia — it's about the fact that validation logic living as scattered `if` statements means every new endpoint re-derives "what counts as a valid amount" from scratch, and someone will eventually get it wrong in a way that matters (a negative reimbursement amount, an empty leave reason where one should be required, etc.).

### 2.5 No structured logging or observability
Default ASP.NET Core console logging only. No Serilog, no correlation IDs, no request logging middleware. When something goes wrong in production, there is currently no way to trace "what happened during this specific user's request" across the stack — you'd be grepping raw console output by timestamp. For a multi-tenant system, this also means no per-tenant operational visibility (which tenant is generating errors, which tenant is slow).

---

## 3. Security posture — decent bones, real gaps

- **Rate limiting** exists only on login (10/min per IP). Password reset, search, and every other endpoint have no rate limiting — a script can hammer `/api/search` or `/api/users/{id}/reset-password` with no throttling.
- **CORS** is origin-restricted (good) but wide open on headers and methods (`AllowAnyHeader().AllowAnyMethod()`) — tighter than "allow everything" but looser than it needs to be.
- **No Content-Security-Policy header.** Basic headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) are set manually, which is good instinct, but there's no CSP — meaningful for a system that will eventually render user-supplied content (announcement text, document names, leave reasons) back into the DOM.
- **No `UseHsts()` call**, only `UseHttpsRedirection()` — HSTS is what actually prevents a downgrade attack on repeat visits; redirect alone doesn't.
- **The JWT signing key is a placeholder by design** (`"CHANGE_ME_USE_..."` in `appsettings.json`, meant to be overridden via user-secrets/env var) with a startup throw if unset — a sound pattern, but nothing *enforces* that the real deployment actually overrides it. This is a "trust the deploy process" gap, not a code gap, but it's worth a documented pre-launch checklist item.

---

## 4. Feature completeness — measured against the original module spec

`docs/modules.md` scoped nine HR modules up front. Cross-checking against what actually got built this session:

| Module | Status |
|---|---|
| Attendance | ✅ Built |
| Leave (two-stage) | ✅ Built, hardened this session (explicit state machine, cancellation, HR-reject reasons required) |
| Full & Final Settlement | ✅ Built |
| Employee Documents | ✅ Built |
| Onboarding | ✅ Built |
| **Payroll** | ❌ **Not built at all.** No salary structure, no payroll run, no payslips. This is arguably the single largest missing piece for an HR system to be "complete" — Leave and F&F both explicitly depend on it (unpaid-leave deduction, LOP days, final payout) and currently that math doesn't exist. |
| **Job Posting & Performance Reviews** | ❌ Not built. No recruiting pipeline, no review-cycle tracking. |
| **Personal Details (self-service beyond basics)** | ⚠️ Partial — My Profile exists, but bank details, emergency contacts, and HR-editable "any employee's" view from the original spec aren't there. |
| **POSH Training compliance tracking** | ❌ Not built. |
| Announcements & Policies | ✅ Built |

Separately, the Finance/Accounting core explicitly scoped out **AP/AR vendor-bill workflows** and **Tax Reports** as a deliberate "minimal core" decision — that was the right call for shipping something real quickly, but it means Accounts Payable/Receivable and any tax-reporting capability are still zero, not partial.

**Bottom line: as an HR system, the leave/attendance/onboarding/documents/F&F spine is real and solid. As a payroll or recruiting system, it doesn't exist yet.** Calling this "fully professional and complete" without Payroll specifically is not accurate — that's the module every other HR feature (leave deductions, final settlement payout, attendance LOP) was written assuming would eventually exist.

---

## 5. Workflow and UX weak points found empirically this session

These aren't hypothetical — each one caused a real, reported bug during this build:

1. **New hires can be created with no reporting manager, and nothing stops it or warns loudly enough.** Every employee in the tenant had `ReportingManagerId = NULL` until this was caught, which meant leave requests silently had nowhere to go — invisible to both the manager and HR, with no error message telling anyone why. The form field now exists, but there's still no *hard* guard preventing a manager-less employee from being created; the People table just shows "None set" in red after the fact.
2. **Balance-year lookups used two different conventions in three different places** (`request.StartDate.Year` in one spot, `DateTime.UtcNow.Year` everywhere else) before being unified — the kind of inconsistency that validation/tests in §2 would have caught immediately instead of via a support report.
3. **Deactivating a user didn't update the linked employee's status**, so "removed" people kept showing as Active in People and in HR's manage-users list. Two structurally connected pieces of state (login account, employee record) had no code path guaranteeing they stayed in sync.
4. **Assigned tasks had no visibility path to the assignee at all** — a manager could assign a task and the employee had no page, anywhere, that would ever show it to them. This wasn't a bug in existing code; it was a completed half of a feature (assignment) with the other half (notification/visibility) never built.
5. **Bulk-approve exists for Timesheet and Expense but was deliberately removed for Leave** once the review screen (balance + history + comment) was added, because bulk-approving without seeing that context defeats the point of having it. This is the right call, but it means the three approval surfaces are no longer symmetric — worth a decision on whether that's permanent policy or a temporary gap.
6. **No notification when a task is assigned, a leave decision is made, or a document expires** — the Notifications bell only surfaces *pending approvals*, not "this happened to something you own." An employee currently has no way to know a task was assigned to them except by manually checking a page.
7. **Org-chart edge cases have no owner.** Anyone with no manager above them (the top Manager, HR staff) has no leave-approval path at all if they ever submit their own leave request — this was flagged, not fixed, because it's a real organizational-design question ("who approves the approver's leave?"), not a code bug. It will surface as a support ticket the first time it happens for real.
8. **Manual SQL was required multiple times this session** to fix data (backfilling reporting managers, correcting employee status, hard-deleting records, remapping stale roles). Every one of these should really be an admin-facing tool, not a database console operation — the fact that they weren't is itself a finding: the admin surface doesn't yet cover the operations that actually come up in practice.

---

## 6. Smaller but real gaps

- **Frontend error handling is inconsistent.** Roughly half of sampled pages (`People`, `AuditLog`) show a proper loading state and a user-facing error message on API failure. The other half (`Timecard`, `MyApprovals`, `FinanceDashboard`, `ProjectBudget`) show nothing at all if a request fails — the page just looks broken with no explanation. This should be a shared hook/pattern, not a per-page decision.
- **Accessibility is inconsistent.** Interactive elements are consistently real `<button>`s (not `<div onClick>`), which is the right instinct, but `aria-label`s on icon-only buttons and explicit form-field associations are rare — only 2 page files reference `aria-*` attributes at all, against 75+ using `onClick`.
- **No API documentation beyond bare schema generation.** `AddOpenApi()`/`MapOpenApi()` is wired up but Development-only, with no Swagger UI, no endpoint summaries, and no XML-doc enrichment. Anyone integrating against this API today is reading controller source, not docs.
- **Global search covers only Employees and Projects** — not leave requests, expenses, job titles, or announcements. Reasonable initial scope, but worth stating explicitly as scope, not an oversight.
- **The Accounting core has no period-closing concept** — journal entries can be posted to any date at any time, with no "lock last month" mechanism. Fine for a minimal core; a real problem the moment two people are entering data concurrently near a month boundary.

---

## 7. Recommendations, in priority order

**Before calling this production-ready for a real company (not a pilot):**
1. Stand up a backend test project and cover the three approval state machines + the tenant-isolation filter + the role-creation boundary checks. This is the highest-leverage single investment — it would have caught 3 of the bugs found this session before they shipped.
2. Add a global exception handler with a consistent, sanitized error response shape.
3. Design and apply pagination once, as a shared pattern, before any list grows past a few hundred rows.
4. Decide on and implement Payroll — even a minimal version (salary structure, monthly run, payslip PDF) — since Leave and F&F's own numbers are currently incomplete without it.

**Before scaling past a handful of tenants:**
5. Structured logging with correlation IDs, so a production incident is traceable.
6. A validation layer (FluentValidation) applied consistently, replacing the scattered manual `if` checks.
7. Rate limiting beyond login — at minimum on password reset and search.
8. An admin-facing tool for the operations that currently require direct SQL (reassign manager in bulk, fix employee status, hard-delete with confirmation) — every one of these came up organically during this session and will come up again in real operation.

**Worth doing, lower urgency:**
9. Accessibility pass on icon-only buttons and form labeling.
10. Consistent frontend loading/error state pattern (a shared hook), applied to the pages currently missing it.
11. A real API reference (Swagger UI + endpoint descriptions) once the API surface stabilizes.
12. A decision, documented, on who approves leave for people with no manager above them.

---

## 8. Honest summary

This is a well-architected system for the scope it has actually built — the multi-tenancy, permission, and approval-engine foundations are the kind of thing that's hard to retrofit and easy to get wrong, and they're not wrong here. What it is *not* yet is a finished, production-hardened ERP: there's no safety net (tests), no bounded growth story (pagination), one major module missing entirely (Payroll), and several places where the operational reality of running this for a real company hasn't been built yet (admin tooling for the fixes that keep coming up, notifications beyond approvals, consistent error handling). None of that is a sign of the project being built badly — it's the normal, honest gap between "the core works and the demo is convincing" and "this is ready to hand to a company's actual HR and Finance teams unattended."

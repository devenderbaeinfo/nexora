# Bug & Issue Tracker

Two sections: **Known issues** (things already identified, not yet fixed — either by design decision or because they're bigger than a quick patch) and **Manual QA log** (a template for you to fill in as you test).

---

## Known issues (open)

Format: **Severity** — description. Where it belongs (Backend/Frontend/Both). Notes on why it's still open.

### High

- **No automated tests.** Every regression is currently caught by manual testing only. Three real bugs shipped this session that a test suite would have caught before they were ever seen in the UI (reporting-manager-not-set breaking the leave workflow silently, a balance-year lookup mismatch, HR-approval-status defaulting wrong). Not fixed here per your request — you're covering testing yourself.
- **No pagination on any list endpoint.** Employees, Projects, Departments, Customers, Reimbursements, etc. all return their full result set unbounded. Fine at current data volume; will need addressing before this scales past a few hundred rows per tenant. (Backend)
- **Org-chart edge case: nobody approves a top-of-hierarchy person's own leave.** If the top Manager, or an HR user, ever submits their own leave request, there is no one positioned as their "manager" to clear the first stage — the request will sit in `PendingManagerApproval` forever. This is an organizational-design question (who approves the approver?), not a code bug, and needs a policy decision (e.g. Admin can stand in) before it's worth building. (Both)
- **Payroll doesn't exist.** No salary structure, no payroll run, no payslips. Leave's unpaid-deduction math and F&F's final-payout calculation are both written assuming this will exist eventually, and currently don't have real numbers to draw from.

### Medium

- **Global search only covers Employees and Projects** — not leave requests, expenses, job titles, documents, or announcements. Scoped intentionally when built; worth revisiting if usage shows people expect more.
- **No period-closing in Accounting.** Journal entries can be posted to any date at any time — nothing prevents backdating into a month that should already be "closed." Fine for a single bookkeeper; a real risk the moment two people post concurrently near a month boundary.
- **Accessibility: icon-only buttons mostly lack `aria-label`.** Interactive elements are real `<button>` elements throughout (not `<div onClick>`), which is the harder part done right — but explicit ARIA labeling on icon-only controls (bell, search, avatar menus) is inconsistent.
- **No Swagger UI / endpoint documentation.** The OpenAPI spec is generated (`/openapi/v1.json`, Development only) but has no summaries, descriptions, or a browsable UI. Anyone integrating against the API is reading controller source.

### Low

- **Job title / department names have no realistic length cap beyond the newly-added 200 chars** — fine, but worth revisiting if you ever want tighter limits per field (e.g. department names probably shouldn't need 200 chars).
- **Finance's Accounting nav section was removed entirely** per your explicit instruction — Chart of Accounts, Journal Entries, General Ledger, and Bank/Cash are now only reachable by direct URL, not from the sidebar. Flagging this here so it's a recorded decision, not a forgotten regression, in case it turns out to be needed later.

---

## Fixed this pass (for reference — not open issues)

- Sidebar/topbar no longer scroll away with long page content — only the main content area scrolls now, in both the client app shell and the Super Admin layout.
- The dark-mode cursor spotlight now spans the entire screen (sidebar + main content), and is present in both the client app and the Super Admin/Platform layout — previously it was sidebar-only and client-app-only.
- Added a global exception handler — an unhandled exception anywhere in the API now logs server-side with a correlation ID and returns one consistent, sanitized error response, instead of leaking framework defaults.
- Added rate limiting on password reset and search (previously only login was rate-limited).
- Added HSTS in non-Development environments.
- Tightened input validation: category/date/name/amount checks added to Project Expense, Reimbursement, Project, Job Title, Leave Type, Customer, and Department creation endpoints (empty-string and unbounded-length holes, missing future-date checks, missing negative/out-of-range checks).
- Added missing loading/error states to `ProjectBudget`, `MyApprovals`, `FinanceDashboard`, and `Timecard` — previously a failed API call on these pages rendered nothing with no explanation.

---

## Manual QA log

Fill this in as you test. Suggested columns — adjust as you like:

| Date | Area | Description | Steps to reproduce | Severity | Status |
|------|------|--------------|---------------------|----------|--------|
| | | | | | |

**Severity guide:** Critical (data loss / security / blocks core workflow) · High (feature broken, workaround exists) · Medium (annoying, non-blocking) · Low (cosmetic).

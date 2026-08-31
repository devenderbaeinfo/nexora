# HR Module — Spec Doc

Scope: features available to every user in the `HR` role, across all tenants. Any tenant employee assigned the `HR` role (by `Admin`) gets the same module set — no per-tenant I can say it comes.or per-HR customization of *which* modules exist. Follows the existing permission-string + `[RequirePermission(...)]` model (see root `README.md`).

## Modules

### 1. Attendance
- Clock in/out, daily attendance log per employee.
- HR view: team/tenant-wide attendance dashboard, corrections/overrides.
- Permission: `attendance.view_all`, `attendance.correct`.

### 2. Leave
- Already partially implemented: two-stage approval Employee → Manager → HR (`ApprovalWorkflowService`).
- HR scope: final approval, leave balance configuration, leave-type setup (paid/sick/casual/etc.), holiday calendar.
- Permission: `leave.approve` (existing), `leave.configure`.

### 3. Full & Final Settlement (F&F)
- Triggered on employee exit/resignation.
- Checklist-driven: pending dues, asset return, clearance from Manager/Finance/IT, final payout calculation.
- HR scope: initiate, track clearance status per department, close settlement.
- Permission: `fnf.initiate`, `fnf.approve`.

### 4. Employee Documents
- Per-employee document store: offer letter, ID proofs, contracts, certificates.
- HR scope: upload on behalf of employee, mark verified/expired, restrict visibility (self + HR only, unless shared).
- Permission: `employee_docs.manage`.

### 5. Onboarding
- New-hire checklist: document collection, account provisioning trigger, induction schedule, POSH training assignment.
- HR scope: create onboarding plan per new hire, track completion.
- Permission: `onboarding.manage`.

### 6. Payroll
- Salary structure per employee, monthly payroll run, payslip generation.
- Ties into Leave (unpaid leave deduction), Attendance (LOP days), F&F (final payout).
- HR scope: run payroll, adjust one-off items, publish payslips.
- Permission: `payroll.run`, `payroll.view_all`.

### 7. Job Posting & PR Reviews
- Job posting: HR creates/publishes open positions (internal or external-facing).
- PR reviews: candidate/performance review records tied to a posting or an existing employee's review cycle.
- Permission: `job_posting.manage`, `pr_review.manage`.

### 8. Personal Details
- Employee's own profile (contact info, emergency contact, bank details, etc.).
- HR scope: view/edit for any employee in tenant (Employee self-service is separate, existing scope).
- Permission: `personal_details.manage_all`.

### 9. POSH Training
- Track completion of mandatory POSH (Prevention of Sexual Harassment) training per employee.
- HR scope: assign training, record completion, generate compliance report.
- Permission: `posh_training.manage`.

## Cross-cutting: Announcements & Policies
- Every page shows an **Announcements** section.
- Editable by: `HR` role under the **Admin category** (not restricted to `SuperAdmin` or tenant `Admin`) — i.e., HR can publish/edit announcements and policy documents (POSH policy, sick leave, paid leave conditions, etc.) visible to **all users in the tenant**.
- Read-only for everyone else; HR-only write.
- Permission: `announcements.manage` (new permission, granted to `HR` role template alongside existing HR permissions).
- Suggested placement: shared layout component, similar to how `tokens.css` is loaded globally — an `AnnouncementBanner`/`PolicyPanel` component pulled into the app shell so it renders on every page without per-page wiring.

## Notes on fit with existing architecture
- New permission strings above should be added to `RoleTemplates.AssignableRolesByCreatorRole` / the HR role's permission set in `Erp.Domain`, not hardcoded in the frontend.
- F&F, Payroll, and Onboarding may want their own approval stages later — if so, reuse `ApprovalWorkflowService` (`Erp.Infrastructure/Workflow`) rather than hand-rolling new state machines, consistent with how Leave/Reimbursement/Project Expense already share it.
- Employee Documents and Personal Details need tenant + row-level scoping via `ErpDbContext`'s existing global query filter — no new mechanism required.

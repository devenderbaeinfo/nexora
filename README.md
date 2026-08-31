# ERP Platform

Multi-tenant ERP, built to run internally first (Stage 1) and be sold as a product later (Stage 2). React frontend, .NET backend,and SQL Server.

## Prerequisites
- .NET SDK 9/10, Node 20+, SQL Server (Express is fine) running locally

## First-time setup

**Database** — the API creates the `erp` database itself via migrations on first run; no manual step needed as long as SQL Server (Express) is running and you can connect with Windows auth.

**Backend secrets** (never commit real values — `appsettings.json` only holds placeholders)
```
cd backend/src/Erp.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost\SQLEXPRESS;Database=erp;Trusted_Connection=True;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)"
```
Adjust the server name if your instance isn't named `SQLEXPRESS` (check with `sc query` for `MSSQL$<instance>`, or use `.` / `localhost` for a default instance).

**Trust the local HTTPS dev certificate** (one-time, avoids browser TLS errors)
```
dotnet dev-certs https --trust
```

**Run the API** (auto-applies migrations and seeds a demo tenant in Development)
```
dotnet run --project backend/src/Erp.Api
```
This listens on `https://localhost:7030` (see `backend/src/Erp.Api/Properties/launchSettings.json` — the frontend's `.env.development` points here). Leave this terminal running.

**Role hierarchy & demo logins** — password `ChangeMe!2026x` for all, **change this seed before any real deployment**:

| Role | Workspace | Email | Can do |
|---|---|---|---|
| SuperAdmin | `platform` | `superadmin@platform.test` | Provision new tenants + their first Admin (`/api/platform/tenants`) |
| Admin | `acme` | `admin@acme.test` | Create HR/Manager/Finance accounts; create customers & projects |
| HR | `acme` | `hr@acme.test` | Create Employee and Manager accounts; final approval on leave |
| Manager | `acme` | `manager@acme.test` | First-stage approval on direct reports' leave/expense claims; is the seeded Project Manager on the demo project |
| Finance | `acme` | `finance@acme.test` | Final approval on reimbursements and project expenses |
| Employee | `acme` | `priya.nair@acme.test` | Submit leave/expenses/project expenses, view own balance |

Three modules run two-stage approvals through a shared engine (`Erp.Infrastructure/Workflow/ApprovalWorkflowService.cs`):
- **Leave**: Employee → Manager → HR
- **Reimbursement**: Employee → Manager → Finance
- **Project Expense**: Employee → the specific project's own Project Manager → Finance

The engine owns the state machine (whose turn it is, when it's finished); each controller owns its own domain rule for who may act at a stage — Leave/Reimbursement check the submitter's reporting manager, Project Expense checks the *project's* `ProjectManagerId` instead, proving the engine isn't secretly leave-shaped. Adding a new approval flow means one line in `WorkflowDefinitions` plus a controller that follows the same shape — not a new hand-rolled state machine. The leave balance / payment-cleared flag is only ever set at the final stage, never before.

Who can create whom (`Admin` → HR/Manager/Finance, `HR` → Employee/Manager) is enforced server-side (`RoleTemplates.AssignableRolesByCreatorRole` in `Erp.Domain`), not just hidden in the UI.

**Run the frontend**
```
cd frontend
npm install
npm run dev
```

## Architecture
- `backend/src/Erp.Domain` — entities, no framework dependencies
- `backend/src/Erp.Application` — business rules (leave/expense/approval logic lands here)
- `backend/src/Erp.Infrastructure` — EF Core, SQL Server, tenant-scoping (`ErpDbContext`), the shared approval workflow engine
- `backend/src/Erp.Api` — controllers, auth, JWT issuance, permission policies

## Multi-tenancy & security, by design
- Every tenant-owned table carries `TenantId`; `ErpDbContext` applies a **global query filter** so a forgotten `WHERE` clause can't leak another company's data, and re-stamps `TenantId` on every write from the caller's own JWT — never from client input.
- Permissions are granular strings (`leave.approve`, `accounting.post_entries`, …) baked into the JWT at login and checked per-endpoint via `[RequirePermission(...)]`.
- Passwords: ASP.NET Identity hashing, 12-char minimum, account lockout after 5 failed attempts; login is additionally IP-rate-limited.
- Every login attempt (success, failure, and denied access) writes an append-only `AuditLog` row — nothing in this codebase should ever `UPDATE`/`DELETE` that table.
- Login and employee-lookup errors are deliberately generic to avoid tenant/email enumeration.

## Design system
Frontend tokens live in `frontend/src/styles/tokens.css` — one system, two premium themes (light: purple-on-white; dark: deep navy with a restrained purple glow), toggle in the top bar, persisted per-browser. Playfair Display for major headings, Inter everywhere else.

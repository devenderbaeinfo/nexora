# Nexora

Multi-tenant ERP, built to run internally first (Stage 1) and be sold as a product later (Stage 2). React frontend, .NET backend, SQL Server. Backend is a modular monolith — one deployable, one database, hard module boundaries enforced by project references, not microservices.

## Prerequisites
- .NET SDK 9/10, Node 20+, SQL Server (Express is fine) running locally

## First-time setup

**Database** — the API creates the `erp` database itself via migrations on first run; no manual step needed as long as SQL Server (Express) is running and you can connect with Windows auth.

**Backend secrets** (never commit real values — `appsettings.json` only holds placeholders)
```
cd backend/src/Nexora.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost\SQLEXPRESS;Database=erp;Trusted_Connection=True;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)"
```
Adjust the server name if your instance isn't named `SQLEXPRESS` (check with `sc query` for `MSSQL$<instance>`, or use `.` / `localhost` for a default instance).

**Trust the local HTTPS dev certificate** (one-time, avoids browser TLS errors)
```
dotnet dev-certs https --trust
```

**Run the API** (auto-applies migrations and seeds a SuperAdmin in Development, on a first-run empty database only)
```
dotnet run --project backend/src/Nexora.Api
```
This listens on `https://localhost:7030` (see `backend/src/Nexora.Api/Properties/launchSettings.json` — the frontend's `.env.development` points here). Leave this terminal running.

**First login** — `DevSeeder` (`backend/src/Nexora.Api/Seed/DevSeeder.cs`) seeds exactly one account, the platform tenant's SuperAdmin, and only when the `Tenants` table is empty:

| Role | Workspace | Email | Password |
|---|---|---|---|
| SuperAdmin | `platform` | `sadmin@gmail.com` | `ChangeMe!2026x` — **change this before any real deployment** |

Everything else — client tenants, their first Admin, and every HR/Manager/Finance/Employee account under them — is created for real through the provisioning APIs from there on, not seeded:
1. SuperAdmin calls `POST /api/platform/tenants` to provision a new tenant + its first Admin.
2. That tenant's Admin uses `POST /api/users` to create HR/Manager/Finance/Employee accounts (`UsersController`).
3. A SuperAdmin can add another Admin to an existing tenant via `POST /api/platform/tenants/{id}/admins`, without provisioning a new tenant.

Who can create whom is enforced server-side, not just hidden in the UI (`RoleTemplates.AssignableRolesByCreatorRole` in `Nexora.Modules.Identity`):
- `Admin` → HR, Manager, Finance, Employee (not another Admin)
- `HR` → Employee, Manager
- Only a `SuperAdmin` creates `Admin` accounts, and only through the platform provisioning endpoints above.

Three modules run two-stage approvals through a shared engine (`Nexora.Modules.Workflow/Services/ApprovalWorkflowService.cs`):
- **Leave**: Employee → Manager → HR
- **Reimbursement**: Employee → Manager → Finance
- **Project Expense**: Employee → the specific project's own Project Manager → Finance

The engine owns the state machine (whose turn it is, when it's finished); each controller owns its own domain rule for who may act at a stage — Leave/Reimbursement check the submitter's reporting manager, Project Expense checks the *project's* `ProjectManagerId` instead, proving the engine isn't secretly leave-shaped. Adding a new approval flow means one entry in `WorkflowDefinitions` plus a controller that follows the same shape — not a new hand-rolled state machine. The leave balance / payment-cleared flag is only ever set at the final stage, never before.

**Run the frontend**
```
cd frontend
npm install
npm run dev
```

## Architecture
Modular monolith under `backend/src/`:
- `Nexora.Shared` — cross-cutting concerns with no business logic: tenancy primitives (`Tenant`), the `TenantEntity` base type, shared authorization plumbing.
- `Nexora.Modules.Identity` — users, roles, permission templates, JWT/claims.
- `Nexora.Modules.HR` — employees, leave, timesheets, onboarding, employee documents, F&F.
- `Nexora.Modules.Payroll` — salary structures, payroll runs, payslips.
- `Nexora.Modules.Projects` — projects, project members, project expenses, reimbursements.
- `Nexora.Modules.Finance` — chart of accounts, accounting entries, accounts payable.
- `Nexora.Modules.Workflow` — the shared approval-chain engine used by Leave/Reimbursement/Project Expense.
- `Nexora.Modules.Company` — departments, job titles, locations.
- `Nexora.Modules.Reporting` — cross-module reports and report access grants.
- `Nexora.Modules.Notifications` — in-app notifications.
- `Nexora.Modules.Onboarding` — new-hire onboarding checklists.
- `Nexora.Modules.Platform` — SuperAdmin-only tenant provisioning, reachable only from the reserved `platform` tenant.
- `Nexora.Api` — the single ASP.NET Core host: controllers wire into their owning module, `NexoraDbContext` (EF Core, SQL Server), JWT issuance, permission policies, migrations.

## Multi-tenancy & security, by design
- Every tenant-owned table extends `TenantEntity` and carries `TenantId`; `NexoraDbContext` applies a **global query filter** to every such entity so a forgotten `WHERE` clause can't leak another company's data, and a `SaveChanges` interceptor re-stamps `TenantId` on every insert/update from the caller's own JWT — never from client input.
- `AppUser`/`AppRole` are the one deliberate exception to that automatic filter (a user's tenant is settled before the filter can apply) — any raw lookup on them must include an explicit `TenantId` check at the call site; this is a known sharp edge, not an oversight.
- Permissions are granular strings (`leave.approve`, `people.manage`, …) baked into the JWT at login and checked per-endpoint via `[RequirePermission(...)]` — enforced server-side, not just hidden nav items.
- Passwords: ASP.NET Identity hashing (PBKDF2-HMAC-SHA256), 12-char minimum with complexity rules, account lockout after 5 failed attempts, forced rotation every 180 days; login is additionally IP-rate-limited, separately from per-account lockout.
- Every login attempt (success, failure, and denied access) writes an append-only `AuditLog` row — nothing in this codebase should ever `UPDATE`/`DELETE` that table.
- Login and employee-lookup errors are deliberately generic to avoid tenant/email enumeration.
- CORS is an explicit allow-list from config (`Cors:AllowedOrigins`), never a wildcard combined with credentials.

## Design system
Frontend tokens live in `frontend/src/styles/tokens.css` — one system, two premium themes (light: purple-on-white; dark: deep navy with a restrained purple glow), toggle in the top bar, persisted per-browser. Playfair Display for major headings, Inter everywhere else.

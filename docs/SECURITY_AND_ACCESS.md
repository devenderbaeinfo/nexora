# NEXORA ERP — Security & Access Document

**Status:** living document, reflects the codebase as of 2026-09-02.

---

## 1. Authentication

- **Identity provider**: ASP.NET Core Identity, `AddIdentityCore<AppUser>` (not the full
  cookie-based `AddIdentity`) — this app is a pure JWT-bearer API, no server-rendered auth pages.
- **Login is by email alone**, globally unique across the entire platform (`RequireUniqueEmail =
  true`) — there is no separate "workspace" field at login; the tenant is resolved from the
  account itself.
- **Password policy**: minimum 12 characters, requires non-alphanumeric and uppercase characters.
  Deliberately strict "for a product that will hold payroll and expense data" (see `Program.cs`
  comment).
- **Account lockout**: 5 failed attempts → 15-minute lockout, via Identity's own lockout store
  (per-account, independent of the IP-based rate limit below).
- **Password reset**: Identity's default token providers, exposed via `UsersController`.
- **Forced password change**: a dedicated middleware
  (`RequirePasswordCurrentMiddleware`) runs after authentication and before authorization,
  blocking any authenticated request until a required password change is completed.
- **JWT issuance**: on successful login, a signed JWT is issued carrying the user's identity,
  `tenant_id`, `role_id` claim(s), and every granted permission as `"perm"` claims — the token
  *is* the caller's authorization state for that session; nothing about permissions is
  re-derived from a fresh DB lookup on every request (only the coarse-to-fine data-scope layer,
  §3, hits the DB per relevant request).
- **Signing key**: read from configuration (`Jwt:SigningKey`), with a hard startup failure if
  unset — `appsettings.json` only holds a placeholder value (`"CHANGE_ME_USE_..."`), the real
  value is meant to live in `dotnet user-secrets` (dev) or an environment variable (prod).
  Outside `Development`, startup also fails if the configured value **is** that checked-in
  placeholder or is shorter than 32 characters — presence alone used to be enough to pass, which
  meant a deploy that forgot to override the placeholder would start up "successfully" while
  signing every token with a key sitting in source control.
- **Token validation**: issuer, audience, lifetime, and signing key are all validated
  (`ValidateIssuer/Audience/Lifetime/IssuerSigningKey = true`), 1-minute clock skew.
- **Transport**: `RequireHttpsMetadata` is only relaxed in Development; production requires HTTPS
  for the JWT bearer handler itself, in addition to `UseHttpsRedirection()`/`UseHsts()`
  (Production only) at the pipeline level.
- **Enumeration resistance**: login and employee-lookup error messages are deliberately generic,
  to avoid confirming whether a given email or tenant exists.

## 2. Authorization — Layer 1: Permission Claims

- **`Permission.cs`** is a static, compile-time catalogue of `module.action`-shaped permission
  strings (e.g. `leave.approve_as_hr`, `accounting.post_entries`, `payroll.approve`) — not a
  stringly-typed magic string scattered through the app. A typo fails at build time.
- **`[RequirePermission(...)]`** decorates controller actions; it's backed by a dynamic
  `PermissionPolicyProvider` + `PermissionAuthorizationHandler` that checks the current
  request's JWT for a matching `"perm"` claim. A new `Permission.*` constant is usable the moment
  it's added — no separate policy-registration step.
- **`Permission.Platform.*`** (currently `ManageTenants`) is reserved for the BAE operator
  tenant only — explicitly excluded from `Permission.Catalog()`'s output to the tenant-facing
  Roles UI, so a customer tenant can never grant itself platform-operator permissions even via
  a custom role.

## 3. Authorization — Layer 2: Data Scope & Field Access

On top of the flat "can this caller call this endpoint at all" check, `DataScopeService`
(`Erp.Infrastructure/Authorization`) answers two finer questions:

1. **`ResolveAsync(user, permissionKey)`** — which specific records (all / none / a specific id
   list) can this caller's role see under this permission? Backed by `PermissionScope` +
   `PermissionScopeRecord`. No configured scope for a role+permission pair means **unrestricted**
   — existing tenants that never touch this see no behavior change from before the feature
   existed.
2. **`FieldAccessAsync(user, resource, fieldName)`** — can this role view/edit this specific
   field on this resource? Backed by `RoleFieldPermission`. No row means **View** (visible),
   same default-open behavior as before field permissions existed.

Both reads derive the caller's role(s) from the JWT's own `role_id` claim(s) — never from a
client-supplied role or record id — so this layer cannot be spoofed without the JWT signing key
itself being compromised. **Currently wired into**: `AuthController`, `ProjectsController`,
`EmployeesController`, `JobTitlesController`, `UsersController`, `PayrollController`, and
`AccountingController`. Payroll's scoping only ever narrows a `Payroll.Manage`/`Payroll.Approve`
holder's already-broad access (by Department or a specific employee list) — a plain Employee's
`Payroll.View` still means "my own payslips only" regardless of any configured scope row, so this
can't be misconfigured into accidentally widening self-service access. Accounting's scoping
restricts the Chart of Accounts and General Ledger to specific accounts (accounts have no
employee/department owner, so "Department"/"Mine" aren't offered there). `Payslip.GrossEarnings`/
`NetPay` are also wired into field access — hideable for a role viewing *someone else's* payslip,
never the viewer's own. This is still a live extension surface, not a fully universal layer —
extending it further to a new controller/field means one more `DataScopeCatalog`/
`FieldPermissionCatalog` entry plus the same scope-resolution pattern already used in these
controllers.

## 4. RBAC — Roles, Templates, and Customization

- Six system roles ship with a default permission set (`RoleTemplates.PermissionsFor(role)`) —
  the single source of truth used by tenant provisioning, in-tenant user creation, and the dev
  seeder, so there is exactly one definition of "what does HR get by default," not three.
- **A tenant's own Admin can fully customize role permissions**, and **create entirely new custom
  roles** from the same permission catalogue (`RolesController`), gated behind
  `Permission.Admin.ManageRoles`.
- `AppRole.IsCustomized` marks a role an Admin has deliberately edited. `RolePermissionSync`
  (an additive startup job) only tops up *newly shipped* permissions onto roles that are **not**
  customized — so adding a new `Permission.*` constant to the codebase automatically flows to
  every tenant's out-of-the-box roles, without silently overwriting a tenant's own deliberate
  customization.
- **Who can create whom is enforced server-side**, not just hidden in the UI:
  `RoleTemplates.AssignableRolesByCreatorRole` — `Admin` → HR/Manager/Finance/Employee; `HR` →
  Employee/Manager only. A SuperAdmin creates Admins solely as part of provisioning a brand-new
  tenant.
- Every `RolesController` mutation validates permission keys against
  `Permission.Catalog()` server-side — a client cannot grant a role an unknown or
  platform-reserved permission key by crafting a raw request.

## 5. Multi-Tenant Isolation as a Security Control

- Every tenant-owned entity inherits `TenantEntity`; `ErpDbContext` applies one global, reflected
  EF Core query filter (`TenantId == caller's own tenant && !IsDeleted`) to all of them. This is
  the primary defense against cross-tenant data leakage, and it is **structural** — a developer
  writing a new query cannot forget to scope it, because scoping isn't a per-query decision.
- `TenantId` is **re-stamped server-side from the caller's own JWT on every write** — never
  accepted from client-supplied request bodies — closing off a tenant-spoofing vector via a
  crafted payload.
- Deliberate cross-tenant reads (the Platform/Admin portal) opt out explicitly via
  `.IgnoreQueryFilters()`, then filter by an explicit tenant id — every such call site is a
  conscious, auditable exception rather than the default behavior.

## 6. Audit Logging

- An append-only `AuditLog` table records: successful and failed logins, denied-access attempts,
  password resets, role/permission changes, and key business approvals (leave/expense/payroll
  decisions). Nothing in the codebase should ever `UPDATE`/`DELETE` this table.
- This gives a tenant's Admin (`Permission.Admin.ViewAuditLog`) a forensic trail without needing
  direct database access.

## 7. Network & Transport Hardening

- **HTTPS**: `UseHttpsRedirection()` always; `UseHsts()` in non-Development environments only
  (HSTS only meaningfully protects repeat visits once there's a real certificate chain in front
  of the app).
- **Security headers** (applied via inline middleware, before CORS/rate-limiting/auth):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`. These are API-response headers — since
  `Erp.Api` never serves HTML, they matter mainly to the small surface of the app that could ever
  be embedded or content-sniffed as a document response.
- **Content-Security-Policy**: since the API is a pure JSON backend, the CSP that actually
  matters — guarding against the app rendering unescaped user content (announcement text,
  document names, leave reasons) — lives on the **frontend's own document** instead, injected as
  a `<meta>` tag by a Vite plugin (`frontend/vite.config.ts`) at **build time only**. It's
  build-only deliberately: `vite dev`'s React Fast Refresh preamble is an inline `<script>`,
  which a strict `script-src 'self'` blocks outright and breaks the entire dev app, not just a
  cosmetic console warning. `connect-src` is derived from `VITE_API_URL` rather than hardcoded,
  `style-src`/`font-src` allowlist `fonts.googleapis.com`/`fonts.gstatic.com` for the app's
  Google Fonts import. `frame-ancestors` is omitted from the meta tag (browsers ignore it there
  regardless) — enforcing it for real needs a response header from whatever eventually hosts the
  built files.
- **CORS**: origin-restricted via configuration (`Cors:AllowedOrigins`), `AllowCredentials()`,
  scoped to the headers/methods the frontend actually sends
  (`WithHeaders("Content-Type", "Authorization").WithMethods("GET","POST","PUT","PATCH","DELETE")`)
  rather than `AllowAnyHeader().AllowAnyMethod()`.
- **Rate limiting** (`Microsoft.AspNetCore.RateLimiting`, per-client-IP fixed window, independent
  of Identity's own per-account lockout so a distributed credential-stuffing attempt can't just
  spread failed attempts across many accounts to dodge per-account lockout):
  - `login`: 10 requests/minute/IP.
  - `sensitive-action` (e.g. password reset): 10 requests/minute/IP.
  - `search`: 30 requests/minute/IP.
  - **Global default** (`options.GlobalLimiter`): 300 requests/minute/IP, catching every
    endpoint with no more specific policy — previously every authenticated endpoint outside the
    three named policies above had no throttling at all.
  - All reject with HTTP 429 once exceeded, no queueing (`QueueLimit = 0`).

## 8. Error Handling

- A global exception handler (`Erp.Api.Middleware.GlobalExceptionHandler`, registered via
  `AddExceptionHandler<T>()` + `AddProblemDetails()`) is the **first** middleware in the pipeline
  after routing resolution — every unhandled exception anywhere in the API is logged server-side
  and returns a consistent, sanitized `ProblemDetails` response. No stack traces or internal
  exception details reach the client in any environment.

## 9. Input Validation Posture

- No consistent validation layer — `FluentValidation.AspNetCore` is referenced in the API
  project but has **zero actual validator implementations** anywhere in the codebase today.
  Validation is entirely hand-written `if` checks, per controller, with coverage that varies by
  endpoint rather than by risk (e.g. some controllers cap string length and check ranges;
  others check only non-empty).
- **Recommendation**: introduce `AbstractValidator<T>` classes for the highest-risk write
  endpoints first (Payroll salary structures, Accounting journal entries, user/role creation),
  since the package dependency is already present and unused.

## 10. Known Security Gaps (Summary, Priority Order)

1. No automated tests covering authorization boundaries (who can create whom, tenant isolation,
   the approval state machines) — every regression here is currently caught only by manual
   testing.
2. `FluentValidation` is installed but unused — validation coverage is inconsistent and
   hand-rolled.
3. Data Scope / Field Access enforcement (§3) now reaches Payroll and Accounting in addition to
   Employees/Users/Job Titles/Projects/Auth, but is still not applied to every controller (e.g.
   Onboarding, Employee Documents) — a live extension surface, not a finished universal layer.
4. No admin-facing checklist step that actively *confirms* the JWT signing-key guard (§1) passed
   for a given deployment beyond it simply not crashing on startup — the guard is code-enforced,
   but there's no separate deploy-time verification artifact.

Resolved this pass: the CSP gap (§7, moved to the frontend build since the API serves no HTML),
CORS's `AllowAny*` scope (§7), the global rate-limiting gap (§7), and the JWT placeholder-value
gap (§1) — all previously listed here.

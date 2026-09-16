using Microsoft.AspNetCore.Identity;

namespace Nexora.Modules.Identity.Entities;

// Extends Identity's battle-tested password hashing / lockout / token machinery
// rather than reinventing auth. TenantId scopes every login to one company.
public class AppUser : IdentityUser<Guid>
{
    public Guid TenantId { get; set; }

    // Nullable: a user account can exist before HR finishes creating the linked Employee record.
    public Guid? EmployeeId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastLoginAtUtc { get; set; }

    // Who created this login — null for the handful of accounts provisioned outside the
    // normal flow (PlatformController's first Admin, the dev seeder). Lets HR/Admin manage
    // (e.g. deactivate) only the accounts they themselves brought into existence, not every
    // account their role happens to have visibility into.
    public Guid? CreatedByUserId { get; set; }

    // Drives the 6-month rotation policy and the forced-change-on-reset flow: an HR/Admin
    // password reset always sets MustChangePassword — the temp password only works long enough
    // to set a new one, it's never a standing credential.
    public DateTimeOffset PasswordChangedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public bool MustChangePassword { get; set; }

    // Set when this user submits the public "forgot password" form (no self-service reset
    // exists — there's no email infrastructure in this app). Surfaces as a highlighted
    // "Reset password" action to whoever manages this account (UsersController.List);
    // cleared the moment that admin/HR actually resets it.
    public DateTimeOffset? PasswordResetRequestedAtUtc { get; set; }
}

public class AppRole : IdentityRole<Guid>
{
    public Guid TenantId { get; set; }

    // System roles (Owner, Admin) ship with every tenant and can't be deleted;
    // custom roles are created per-tenant via the System Administrator persona.
    public bool IsSystemRole { get; set; }

    // Once an Admin has explicitly edited this role's permission set (via RolesController),
    // RolePermissionSync leaves it alone entirely — a shipped default is a starting point,
    // not something that silently re-applies itself over a tenant's own customization.
    public bool IsCustomized { get; set; }
}

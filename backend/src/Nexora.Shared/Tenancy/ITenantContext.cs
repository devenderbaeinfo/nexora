namespace Nexora.Shared.Tenancy;

// Resolved once per request from the caller's JWT (see JwtTenantContext in the API project).
// The DbContext depends on this abstraction, never on HttpContext directly, so tenant scoping
// stays testable and can't accidentally be bypassed by a background job that has no HTTP request.
public interface ITenantContext
{
    Guid TenantId { get; }
    bool IsResolved { get; }
}

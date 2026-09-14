using Nexora.Shared.Common;

namespace Nexora.Shared.Common;

// Append-only. Nothing in this codebase should ever update or delete a row here —
// that's what makes it usable as evidence, not just as a debug log.
public class AuditLog : TenantEntity
{
    public Guid? ActorUserId { get; set; }
    public string Action { get; set; } = default!;        // e.g. "leave.approve", "auth.login_failed"
    public string EntityType { get; set; } = default!;    // e.g. "LeaveRequest"
    public Guid? EntityId { get; set; }
    public string? Metadata { get; set; }                 // JSON snapshot of what changed
    public string? IpAddress { get; set; }
    public bool WasDenied { get; set; }                    // captures denied access attempts too, per the SRS
}

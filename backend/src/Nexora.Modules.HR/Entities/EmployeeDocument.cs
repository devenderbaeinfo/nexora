using Nexora.Shared.Common;

namespace Nexora.Modules.HR.Entities;

public enum EmployeeDocumentType
{
    OfferLetter,
    IdProof,
    Contract,
    Certificate,
    Other
}

public enum EmployeeDocumentStatus
{
    Pending,
    Verified,
    Expired
}

// Metadata row for a file uploaded to local disk under a tenant-scoped folder
// (see DocumentStorage in Nexora.Api) — StoredFileName is the on-disk name (a fresh Guid,
// never the caller-supplied name) so path traversal and filename collisions aren't a concern.
public class EmployeeDocument : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public EmployeeDocumentType Type { get; set; }
    public string OriginalFileName { get; set; } = default!;
    public string StoredFileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeBytes { get; set; }
    public EmployeeDocumentStatus Status { get; set; } = EmployeeDocumentStatus.Pending;
    public DateOnly? ExpiresOn { get; set; }
    public Guid UploadedByUserId { get; set; }
}

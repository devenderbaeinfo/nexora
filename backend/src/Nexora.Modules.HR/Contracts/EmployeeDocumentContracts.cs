using Nexora.Modules.HR.Entities;

namespace Nexora.Modules.HR.Contracts;

public record EmployeeDocumentDto(
    Guid Id, Guid EmployeeId, string EmployeeName,
    string Type, string OriginalFileName, string ContentType, long SizeBytes,
    string Status, DateOnly? ExpiresOn, DateTimeOffset CreatedAtUtc);

public record VerifyEmployeeDocumentRequest(EmployeeDocumentStatus Status);

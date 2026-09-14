namespace Nexora.Modules.Finance.Contracts;

public record CreateVendorRequest(string Name, string? ContactEmail, string? ContactPhone);
public record VendorDto(Guid Id, string Name, string? ContactEmail, string? ContactPhone, bool IsActive);

public record SubmitVendorBillRequest(Guid VendorId, string BillNumber, DateOnly BillDate, DateOnly DueDate, string Category, decimal Amount);

public record VendorBillDto(
    Guid Id, Guid VendorId, string VendorName, string BillNumber, DateOnly BillDate, DateOnly DueDate,
    string Category, decimal Amount, string Status, Guid? JournalEntryId, string? RejectionReason,
    DateTimeOffset? PaidAtUtc, Guid? PaymentJournalEntryId);

public record RejectVendorBillRequest(string Reason);

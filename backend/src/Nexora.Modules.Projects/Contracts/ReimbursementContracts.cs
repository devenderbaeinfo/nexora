namespace Nexora.Modules.Projects.Contracts;

public record SubmitReimbursementRequest(decimal Amount, string Category, string? Description, string? ReceiptUrl, DateOnly IncurredOn);

public record ReimbursementDto(
    Guid Id, string EmployeeName, decimal Amount, string Category,
    string? Description, DateOnly IncurredOn, string Status, Guid? JournalEntryId);

public record DecideReimbursementRequest(bool Approve, string? Note);

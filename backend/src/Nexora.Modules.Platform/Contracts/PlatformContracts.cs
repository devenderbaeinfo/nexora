namespace Nexora.Modules.Platform.Contracts;

public record CreateTenantRequest(
    string TenantName, string TenantSlug,
    string AdminEmail, string AdminPassword, string AdminDisplayName, string? BaseCurrencyCode);

public record TenantSummaryDto(Guid Id, string Name, string Slug, string Status, string BaseCurrencyCode, DateTimeOffset CreatedAtUtc);

public record UpdateTenantStatusRequest(Nexora.Shared.Tenancy.TenantStatus Status);

public record SuperAdminDto(Guid Id, string Email, bool IsActive);
public record CreateSuperAdminRequest(string Email, string Password);

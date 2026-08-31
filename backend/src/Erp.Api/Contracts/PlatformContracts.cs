namespace Erp.Api.Contracts;

public record CreateTenantRequest(
    string TenantName, string TenantSlug,
    string AdminEmail, string AdminPassword, string AdminDisplayName);

public record TenantSummaryDto(Guid Id, string Name, string Slug, string Status, DateTimeOffset CreatedAtUtc);

public record UpdateTenantStatusRequest(Erp.Domain.Tenancy.TenantStatus Status);

public record SuperAdminDto(Guid Id, string Email, bool IsActive);
public record CreateSuperAdminRequest(string Email, string Password);

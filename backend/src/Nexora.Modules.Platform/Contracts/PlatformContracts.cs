namespace Nexora.Modules.Platform.Contracts;

// PlanId set = a named Plan's modules apply; null = "Custom", ModuleKeys picks them directly.
public record CreateTenantRequest(
    string TenantName, string TenantSlug,
    string AdminEmail, string AdminPassword, string AdminDisplayName, string? BaseCurrencyCode,
    Guid? PlanId, string[]? ModuleKeys);

public record TenantSummaryDto(Guid Id, string Name, string Slug, string Status, string BaseCurrencyCode, DateTimeOffset CreatedAtUtc, Guid? PlanId, string? PlanName);

public record TenantDetailDto(Guid Id, string Name, string Slug, string Status, string BaseCurrencyCode, DateTimeOffset CreatedAtUtc, Guid? PlanId, string[] ModuleKeys);

public record UpdateTenantStatusRequest(Nexora.Shared.Tenancy.TenantStatus Status);

// Same PlanId/ModuleKeys contract as creation, applied to an existing tenant.
public record UpdateTenantPlanRequest(Guid? PlanId, string[]? ModuleKeys);

public record SuperAdminDto(Guid Id, string Email, bool IsActive);
public record CreateSuperAdminRequest(string Email, string Password);

public record CreateTenantAdminRequest(string Email, string Password);
public record TenantAdminDto(Guid Id, string Email, bool IsActive);

public record ModuleDto(string Key, string Label);

public record PlanDto(Guid Id, string Name, decimal? MonthlyPrice, bool IsCustomPricing, int? MaxUsers, string Status, string[] ModuleKeys, int SubscriberCount);
public record CreatePlanRequest(string Name, decimal? MonthlyPrice, bool IsCustomPricing, int? MaxUsers, string[] ModuleKeys);
public record UpdatePlanRequest(string Name, decimal? MonthlyPrice, bool IsCustomPricing, int? MaxUsers, string[] ModuleKeys, Nexora.Shared.Tenancy.PlanStatus Status);

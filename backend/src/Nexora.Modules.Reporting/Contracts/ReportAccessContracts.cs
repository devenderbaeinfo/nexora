namespace Nexora.Modules.Reporting.Contracts;

public record ReportKeyCatalogItemDto(string Key, string Label);

public record ReportAccessGrantDto(
    Guid Id,
    Guid? RoleId, string? RoleName,
    Guid? UserId, string? UserName,
    string ReportKey,
    Guid? ProjectId, string? ProjectName);

public record CreateReportAccessGrantRequest(Guid? RoleId, Guid? UserId, string ReportKey, Guid? ProjectId);

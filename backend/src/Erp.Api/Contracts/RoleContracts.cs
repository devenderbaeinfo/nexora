namespace Erp.Api.Contracts;

public record RoleDto(Guid Id, string Name, bool IsSystemRole, bool IsCustomized, List<string> Permissions, int JobTitleCount);
public record PermissionCatalogItemDto(string Module, string Key);
public record CreateRoleRequest(string Name, List<string> Permissions);
public record UpdateRolePermissionsRequest(List<string> Permissions);

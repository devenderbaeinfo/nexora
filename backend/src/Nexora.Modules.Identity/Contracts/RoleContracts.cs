namespace Nexora.Modules.Identity.Contracts;

public record RoleDto(Guid Id, string Name, bool IsSystemRole, bool IsCustomized, List<string> Permissions, int JobTitleCount);
public record PermissionCatalogItemDto(string Module, string Key);
public record CreateRoleRequest(string Name, List<string> Permissions);
public record UpdateRolePermissionsRequest(List<string> Permissions);

public record ScopablePermissionDto(string PermissionKey, string[] AllowedScopeTypes);
public record RoleScopeDto(string PermissionKey, string ScopeType, List<Guid> SpecificRecordIds);
public record UpdateRoleScopeRequest(string ScopeType, List<Guid>? SpecificRecordIds);

public record FieldCatalogItemDto(string Resource, string FieldName);
public record RoleFieldPermissionDto(string Resource, string FieldName, string Access);
public record UpdateRoleFieldPermissionsRequest(string Resource, List<FieldAccessInput> Fields);
public record FieldAccessInput(string FieldName, string Access);

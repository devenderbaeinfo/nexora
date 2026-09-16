namespace Nexora.Modules.Platform.Services;

// Single place that resolves and writes a tenant's effective TenantModule rows, used by both
// tenant creation and later plan/module edits so the resolution logic never drifts between them.
public interface ITenantModuleProvisioningService
{
    // planId: an existing Plan's modules are applied. customModuleKeys: used instead when
    // planId is null ("Custom") — hand-picked module keys, validated against ModuleCatalog.
    Task ResolveAndApplyAsync(Guid tenantId, Guid? planId, IReadOnlyCollection<string>? customModuleKeys);
}

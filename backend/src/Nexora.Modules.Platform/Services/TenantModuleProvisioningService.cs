using Microsoft.EntityFrameworkCore;
using Nexora.Shared.Tenancy;

namespace Nexora.Modules.Platform.Services;

public class TenantModuleProvisioningService : ITenantModuleProvisioningService
{
    private readonly DbContext _db;

    public TenantModuleProvisioningService(DbContext db)
    {
        _db = db;
    }

    public async Task ResolveAndApplyAsync(Guid tenantId, Guid? planId, IReadOnlyCollection<string>? customModuleKeys)
    {
        IReadOnlyCollection<string> resolvedKeys;
        if (planId is Guid id)
        {
            resolvedKeys = await _db.Set<PlanModule>()
                .Where(pm => pm.PlanId == id)
                .Select(pm => pm.ModuleKey)
                .ToListAsync();
        }
        else
        {
            resolvedKeys = (customModuleKeys ?? []).Where(ModuleCatalog.IsValid).Distinct().ToList();
        }

        var existing = await _db.Set<TenantModule>().Where(tm => tm.TenantId == tenantId).ToListAsync();
        _db.Set<TenantModule>().RemoveRange(existing);

        foreach (var key in resolvedKeys)
        {
            _db.Set<TenantModule>().Add(new TenantModule { TenantId = tenantId, ModuleKey = key });
        }

        await _db.SaveChangesAsync();
    }
}

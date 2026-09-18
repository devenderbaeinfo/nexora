using Microsoft.AspNetCore.Authorization;

namespace Nexora.Shared.Authorization;

// Rather than pre-registering ~20 policies by hand (and forgetting one), any policy name
// that isn't already known is treated as a permission key and built on the fly.
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(Microsoft.Extensions.Options.IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();

    public async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        var existing = await _fallback.GetPolicyAsync(policyName);
        if (existing != null) return existing;

        if (policyName.StartsWith("module:", StringComparison.Ordinal))
        {
            var moduleKey = policyName["module:".Length..];
            return new AuthorizationPolicyBuilder()
                .AddRequirements(new ModuleRequirement(moduleKey))
                .Build();
        }

        return new AuthorizationPolicyBuilder()
            .AddRequirements(new PermissionRequirement(policyName))
            .Build();
    }
}

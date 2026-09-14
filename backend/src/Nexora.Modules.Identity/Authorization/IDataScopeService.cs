using System.Security.Claims;
using Nexora.Modules.Identity.Entities;

namespace Nexora.Modules.Identity.Authorization;

public record ScopeDecision(DataScopeType Type, IReadOnlyList<Guid> SpecificIds)
{
    public static readonly ScopeDecision Unrestricted = new(DataScopeType.All, []);
}

// Abstraction lives in the Identity module (it already owns DataScopeType/FieldAccessLevel)
// so every other module can depend on it without creating a cycle back to Nexora.Api, which
// owns the single NexoraDbContext and therefore the concrete implementation — see
// Nexora.Api/Authorization/DataScopeService.cs.
public interface IDataScopeService
{
    Task<ScopeDecision> ResolveAsync(ClaimsPrincipal user, string permissionKey);
    Task<FieldAccessLevel> FieldAccessAsync(ClaimsPrincipal user, string resource, string fieldName);
}

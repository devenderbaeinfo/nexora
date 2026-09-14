using Nexora.Shared.Common;

namespace Nexora.Modules.Projects.Entities;

public class Customer : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
}

using Erp.Domain.Common;

namespace Erp.Domain.Project;

public class Customer : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
}

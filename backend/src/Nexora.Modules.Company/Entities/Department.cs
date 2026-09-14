using Nexora.Shared.Common;

namespace Nexora.Modules.Company.Entities;

public class Department : TenantEntity
{
    public string Name { get; set; } = default!;
    public Guid? ParentDepartmentId { get; set; }
}

public class Location : TenantEntity
{
    public string Name { get; set; } = default!;
    public string? Address { get; set; }
    public string? TimeZoneId { get; set; }
}

using Erp.Domain.Common;

namespace Erp.Domain.People;

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

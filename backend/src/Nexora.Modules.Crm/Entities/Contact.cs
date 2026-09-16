using Nexora.Shared.Common;

namespace Nexora.Modules.Crm.Entities;

public class Contact : TenantEntity
{
    public string FullName { get; set; } = default!;
    public string CompanyName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? Phone { get; set; }
    public ContactType Type { get; set; } = ContactType.Prospect;
}

public enum ContactType
{
    Customer,
    Prospect,
    Partner
}

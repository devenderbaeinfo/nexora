using Nexora.Shared.Common;

namespace Nexora.Modules.Sales.Entities;

public class Lead : TenantEntity
{
    public string CompanyName { get; set; } = default!;
    public string ContactName { get; set; } = default!;
    public string ContactEmail { get; set; } = default!;
    public decimal EstimatedValue { get; set; }
    public LeadStage Stage { get; set; } = LeadStage.New;
}

public enum LeadStage
{
    New,
    Contacted,
    Qualified,
    Won,
    Lost
}

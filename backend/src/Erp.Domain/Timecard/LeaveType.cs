using Erp.Domain.Common;

namespace Erp.Domain.Timecard;

// HR-configurable per tenant — no code change needed to add "Bereavement Leave" etc.
public class LeaveType : TenantEntity
{
    public string Name { get; set; } = default!;
    public decimal AnnualAllowance { get; set; }
    public bool AllowsHalfDay { get; set; }
    public bool RequiresCertificateBeyondDays { get; set; }

    // Self-certification is fine up to this many consecutive days; beyond it a
    // medical certificate must be attached before the request can be approved.
    public int SelfCertificationLimitDays { get; set; }
}

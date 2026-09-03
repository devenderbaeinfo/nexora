using Erp.Domain.Common;

namespace Erp.Domain.Workflow;

// One row per tenant. No row (or a null FallbackApproverEmployeeId) means "no fallback
// configured" — an employee with no ReportingManagerId simply has no approver, same as
// before this existed. An Admin opts in by picking someone here.
public class TenantApprovalSettings : TenantEntity
{
    public Guid? FallbackApproverEmployeeId { get; set; }
}

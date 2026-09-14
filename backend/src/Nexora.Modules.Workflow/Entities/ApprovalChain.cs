using Nexora.Shared.Common;

namespace Nexora.Modules.Workflow.Entities;

public enum ApprovalChainScopeType { Global, Role, JobTitle }

public enum ApproverResolutionType
{
    ReportingManager,   // Employee.ReportingManagerId — today's default behavior
    SkipLevelManager,   // the reporting manager's own ReportingManagerId
    SpecificEmployee,   // ApproverEmployeeId, regardless of org chart — the "swap approver" case
    RoleHolders,        // anyone whose effective role today is ApproverRoleId
    Fallback,           // TenantApprovalSettings.FallbackApproverEmployeeId
}

// A tenant-configured, swappable approval chain — today wired up for LeaveRequest only
// (EntityType is carried so this can extend to other approvable types later without a schema
// change, but Reimbursement/ProjectExpense stay on the static WorkflowDefinitions dictionary
// for now — see IApprovalChainResolver).
//
// Precedence when resolving which chain applies to a given employee: the most specific active,
// matching definition wins — JobTitle-scoped beats Role-scoped beats the tenant's single Global
// definition. If NO definition at all exists for a tenant (the default, common case until an
// Admin opts in), the resolver falls back untouched to today's hardcoded Manager->HR chain via
// ReportingManagerId — the same "no rows = default/unrestricted" idiom PermissionScope and
// ReportAccessGrant already use, so an untouched tenant sees zero behavior change.
public class ApprovalChainDefinition : TenantEntity
{
    public string EntityType { get; set; } = "LeaveRequest";
    public ApprovalChainScopeType ScopeType { get; set; } = ApprovalChainScopeType.Global;

    // Null when ScopeType == Global. Holds an AppRole.Id when Role, a JobTitle.Id when JobTitle.
    public Guid? ScopeKey { get; set; }

    // Deactivating (rather than deleting) reverts affected employees to the next-most-specific
    // active definition (or the hardcoded default if none) without losing the configuration.
    public bool IsActive { get; set; } = true;
}

// One ordered stage of an ApprovalChainDefinition. StageName is free text shown to users and
// used verbatim as the WorkflowInstance stage name — the workflow engine only cares about
// order/count, never the specific name. By convention the last stage is named "HR" and
// IsHrStage is set to match who Permission.Leave.ApproveAsHr holders act on; earlier stages
// are typically "Manager", "Manager2", etc., but nothing besides IsHrStage is enforced.
public class ApprovalChainStage : TenantEntity
{
    public Guid ChainDefinitionId { get; set; }
    public int StageOrder { get; set; }
    public string StageName { get; set; } = default!;
    public bool IsHrStage { get; set; }

    public ApproverResolutionType ResolutionType { get; set; } = ApproverResolutionType.ReportingManager;

    // Only one of these is meaningful, depending on ResolutionType.
    public Guid? ApproverEmployeeId { get; set; }   // SpecificEmployee
    public Guid? ApproverRoleId { get; set; }        // RoleHolders
}

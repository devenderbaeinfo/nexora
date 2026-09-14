using Nexora.Modules.Workflow.Entities;

namespace Nexora.Modules.HR.Contracts;

public record ApprovalChainStageDto(
    Guid Id, int StageOrder, string StageName, bool IsHrStage,
    ApproverResolutionType ResolutionType,
    Guid? ApproverEmployeeId, string? ApproverEmployeeName,
    Guid? ApproverRoleId, string? ApproverRoleName);

public record ApprovalChainDefinitionDto(
    Guid Id, string EntityType, ApprovalChainScopeType ScopeType,
    Guid? ScopeKey, string? ScopeName, bool IsActive,
    List<ApprovalChainStageDto> Stages);

public record ApprovalChainStageInput(
    string StageName, bool IsHrStage, ApproverResolutionType ResolutionType,
    Guid? ApproverEmployeeId, Guid? ApproverRoleId);

public record CreateApprovalChainDefinitionRequest(
    ApprovalChainScopeType ScopeType, Guid? ScopeKey, List<ApprovalChainStageInput> Stages);

public record UpdateApprovalChainDefinitionRequest(
    bool IsActive, List<ApprovalChainStageInput> Stages);

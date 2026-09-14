using Nexora.Shared.Common;

namespace Nexora.Modules.Onboarding.Entities;

public enum OnboardingTaskCategory
{
    Documentation,
    AccountProvisioning,
    Induction,
    Training,
    Compliance
}

public enum OnboardingTaskStatus
{
    Pending,
    InProgress,
    Completed,
    Skipped
}

// One row per checklist item on a new hire's onboarding plan. HR starts a plan for an
// employee (seeding the default template below) and can add ad-hoc items on top of it;
// there's no approval workflow here — HR (or whoever the task is assigned to) just marks
// items done as the new hire actually completes them.
public class OnboardingTask : TenantEntity
{
    public Guid EmployeeId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public OnboardingTaskCategory Category { get; set; }
    public OnboardingTaskStatus Status { get; set; } = OnboardingTaskStatus.Pending;
    public DateOnly? DueDate { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public string? Notes { get; set; }
}

// The starter checklist every new onboarding plan gets seeded with. HR can add more
// items afterward, or skip ones that don't apply — this is a starting point, not a rulebook.
public static class OnboardingDefaultTemplate
{
    public static readonly (string Title, OnboardingTaskCategory Category)[] Items =
    [
        ("Collect signed offer letter & ID proofs", OnboardingTaskCategory.Documentation),
        ("Collect education & prior employment certificates", OnboardingTaskCategory.Documentation),
        ("Provision email & system accounts", OnboardingTaskCategory.AccountProvisioning),
        ("Assign workstation & access badge", OnboardingTaskCategory.AccountProvisioning),
        ("Schedule induction session", OnboardingTaskCategory.Induction),
        ("Introduce to reporting manager & team", OnboardingTaskCategory.Induction),
        ("Complete POSH training", OnboardingTaskCategory.Training),
        ("Review company policies (leave, code of conduct)", OnboardingTaskCategory.Compliance),
    ];
}

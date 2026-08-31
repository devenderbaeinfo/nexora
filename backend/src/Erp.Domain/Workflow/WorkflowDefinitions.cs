namespace Erp.Domain.Workflow;

// Which stages, in order, a given entity type's approval runs through. Adding a new
// approvable thing (Project Expense, say) means adding one line here plus the permission
// constants for its stages — not a new hand-rolled state machine.
public static class WorkflowDefinitions
{
    public const string LeaveRequest = "LeaveRequest";
    public const string Reimbursement = "Reimbursement";
    public const string ProjectExpense = "ProjectExpense";

    private static readonly Dictionary<string, string[]> Stages = new()
    {
        [LeaveRequest] = ["Manager", "HR"],
        [Reimbursement] = ["Manager", "Finance"],
        [ProjectExpense] = ["ProjectManager", "Finance"],
    };

    public static string[] StagesFor(string entityType) => Stages.TryGetValue(entityType, out var stages)
        ? stages
        : throw new ArgumentOutOfRangeException(nameof(entityType), entityType, "No workflow defined for this entity type.");
}

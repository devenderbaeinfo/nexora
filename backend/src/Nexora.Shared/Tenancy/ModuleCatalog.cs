namespace Nexora.Shared.Tenancy;

// Static catalogue of the purchasable feature areas a Plan can include and a Tenant can be
// entitled to — same "compile-time constants, not a DB table" shape as Permission.cs, since
// the set of modules the app actually has is a deploy-time fact. Only the *association*
// (which modules a given Plan/Tenant has) is data-driven (see Plan, PlanModule, TenantModule).
// Overview/Approvals/Settings are deliberately not modules here — they're administrative
// infrastructure every tenant gets regardless of plan, not a purchasable feature.
public static class ModuleCatalog
{
    public const string People = "people";
    public const string Timecard = "timecard";
    public const string Leave = "leave";
    public const string Reimbursement = "reimbursement";
    public const string Projects = "projects";
    public const string Accounting = "accounting";
    public const string Payroll = "payroll";
    public const string Reports = "reports";

    public static readonly IReadOnlyList<string> AllKeys =
        [People, Timecard, Leave, Reimbursement, Projects, Accounting, Payroll, Reports];

    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        [People] = "People",
        [Timecard] = "Timecard",
        [Leave] = "Leave",
        [Reimbursement] = "Reimbursement",
        [Projects] = "Projects",
        [Accounting] = "Accounting",
        [Payroll] = "Payroll",
        [Reports] = "Advanced Reports",
    };

    public static bool IsValid(string key) => Labels.ContainsKey(key);
}

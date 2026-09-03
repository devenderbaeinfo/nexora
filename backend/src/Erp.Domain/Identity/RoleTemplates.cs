namespace Erp.Domain.Identity;

// Canonical permission set per system role name, shared by tenant provisioning (PlatformController),
// in-tenant user creation (UsersController), and the dev seeder — one definition, not three.
public static class RoleTemplates
{
    public const string SuperAdmin = "SuperAdmin";
    public const string Admin = "Admin";
    public const string Hr = "HR";
    public const string Manager = "Manager";
    public const string Finance = "Finance";
    public const string Employee = "Employee";

    // Who is allowed to create an account in which role.
    // Admin can create anyone in their own org except another Admin (HR, Manager, Finance,
    // or a plain Employee directly) — the BAE SuperAdmin is the only one who creates Admins,
    // and only as part of provisioning a brand-new tenant (see PlatformController).
    // HR can create Employee/Manager accounts, always scoped to their own tenant — nothing
    // in this codebase lets one tenant's HR (or BAE's own platform account) touch another
    // tenant's users; every query here runs inside ErpDbContext's per-tenant filter.
    public static readonly Dictionary<string, string[]> AssignableRolesByCreatorRole = new()
    {
        [Admin] = [Hr, Manager, Finance, Employee],
        [Hr] = [Employee, Manager],
    };

    public static string[] PermissionsFor(string role) => role switch
    {
        SuperAdmin => [Permission.Platform.ManageTenants],

        Admin =>
        [
            Permission.Admin.ManageUsers, Permission.Admin.ManageRoles,
            Permission.Admin.ManageOrgStructure, Permission.Admin.ViewAuditLog,
            Permission.People.View, Permission.People.Manage, Permission.Leave.View, Permission.Leave.ConfigurePolicy,
            Permission.Accounting.View, Permission.Project.View, Permission.Project.ManageBudget,
            Permission.Onboarding.View, Permission.EmployeeDocs.View,
            Permission.Attendance.ViewAll,
            Permission.Fnf.View,
            Permission.Payroll.View,
            Permission.AccountsPayable.View,
        ],

        Hr =>
        [
            Permission.Admin.ManageUsers, // scoped to Employee/Manager only — enforced in UsersController
            Permission.People.View, Permission.People.Manage,
            Permission.Leave.View, Permission.Leave.ApproveAsHr, Permission.Leave.ConfigurePolicy,
            Permission.Timesheet.View,
            Permission.Onboarding.View, Permission.Onboarding.Manage,
            Permission.EmployeeDocs.View, Permission.EmployeeDocs.Manage,
            Permission.Attendance.ClockInOut, Permission.Attendance.ViewAll, Permission.Attendance.Correct,
            Permission.Fnf.View, Permission.Fnf.Manage,
            Permission.Announcements.Manage,
            Permission.Payroll.View, Permission.Payroll.Manage,
        ],

        Manager =>
        [
            Permission.People.View,
            Permission.Leave.View, Permission.Leave.Submit, Permission.Leave.ApproveAsManager,
            Permission.Timesheet.View, Permission.Timesheet.Submit, Permission.Timesheet.Approve,
            Permission.Expense.View, Permission.Expense.Submit, Permission.Expense.ApproveAsManager,
            Permission.Project.View, Permission.Project.SubmitExpense, Permission.Project.ApproveExpenseAsProjectManager,
            Permission.Project.ManageBudget,
            Permission.Onboarding.View, Permission.EmployeeDocs.View,
            Permission.Attendance.ClockInOut, Permission.Attendance.ViewTeam,
            Permission.Fnf.View,
            Permission.Payroll.View,
        ],

        Finance =>
        [
            Permission.Expense.View, Permission.Expense.ApproveAsFinance,
            Permission.Project.View, Permission.Project.ApproveExpenseAsFinance,
            Permission.Accounting.View, Permission.Accounting.PostEntries, Permission.Accounting.RunReimbursement,
            Permission.Attendance.ClockInOut,
            Permission.Payroll.View, Permission.Payroll.Approve,
            Permission.AccountsPayable.View, Permission.AccountsPayable.Manage, Permission.AccountsPayable.Approve,
        ],

        Employee =>
        [
            Permission.People.View,
            Permission.Leave.View, Permission.Leave.Submit,
            Permission.Timesheet.View, Permission.Timesheet.Submit,
            Permission.Expense.View, Permission.Expense.Submit,
            Permission.Project.View, Permission.Project.SubmitExpense,
            Permission.Onboarding.View, Permission.EmployeeDocs.View,
            Permission.Attendance.ClockInOut,
            Permission.Fnf.View,
            Permission.Payroll.View,
        ],

        _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unknown role."),
    };
}

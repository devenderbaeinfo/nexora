namespace Nexora.Modules.Identity.Entities;

// Static catalogue of fine-grained permissions, module.action shaped, so a role
// can grant "leave.approve" without also granting "leave.delete" or "payroll.view".
// Kept as compile-time constants (not a DB table) so a typo fails at build time, not at 2am in prod.
public static class Permission
{
    public static class People
    {
        public const string View = "people.view";
        public const string Manage = "people.manage";
    }

    public static class Leave
    {
        public const string View = "leave.view";
        public const string Submit = "leave.submit";

        // Two-stage approval: a request's own manager clears it first, then HR gives the
        // final sign-off. The leave balance is only ever debited at the HR stage.
        public const string ApproveAsManager = "leave.approve_as_manager";
        public const string ApproveAsHr = "leave.approve_as_hr";
        public const string ConfigurePolicy = "leave.configure_policy";
    }

    public static class EmployeeDocs
    {
        public const string View = "employee_docs.view"; // own docs, or any employee's with Manage
        public const string Manage = "employee_docs.manage"; // upload for anyone, verify/expire
    }

    public static class Onboarding
    {
        public const string View = "onboarding.view";
        public const string Manage = "onboarding.manage"; // create plans, add/edit/complete tasks
    }

    public static class Fnf
    {
        public const string View = "fnf.view"; // own case, or any case with Manage
        public const string Manage = "fnf.manage"; // initiate, clear items, close out with final payout
    }

    public static class Payroll
    {
        public const string View = "payroll.view"; // own payslips, or any employee's with Manage
        public const string Manage = "payroll.manage"; // set salary structures, process a run (Draft)
        public const string Approve = "payroll.approve"; // approve a run and disburse it (posts to accounting)
    }

    public static class Announcements
    {
        // No separate View permission — every authenticated user in a tenant can read
        // announcements/policies (that's the whole point), so the list endpoint just needs [Authorize].
        public const string Manage = "announcements.manage";
    }

    public static class Attendance
    {
        public const string ClockInOut = "attendance.clock_in_out"; // own entries only
        public const string ViewTeam = "attendance.view_team"; // a manager's own direct reports
        public const string ViewAll = "attendance.view_all"; // HR-wide dashboard
        public const string Correct = "attendance.correct"; // HR edits any entry
    }

    public static class Timesheet
    {
        public const string View = "timesheet.view";
        public const string Submit = "timesheet.submit";
        public const string Approve = "timesheet.approve";
    }

    public static class Expense
    {
        public const string View = "expense.view";
        public const string Submit = "expense.submit";

        // Two-stage, same shape as Leave: the employee's own manager clears it first,
        // then Finance gives the final sign-off that actually authorizes payment.
        public const string ApproveAsManager = "expense.approve_as_manager";
        public const string ApproveAsFinance = "expense.approve_as_finance";
    }

    public static class Accounting
    {
        public const string View = "accounting.view";
        public const string PostEntries = "accounting.post_entries";
        public const string RunReimbursement = "accounting.run_reimbursement";
    }

    public static class AccountsPayable
    {
        public const string View = "accounts_payable.view";
        public const string Manage = "accounts_payable.manage"; // vendors, submitting a bill
        public const string Approve = "accounts_payable.approve"; // approve/reject a bill, record a payment
    }

    public static class Project
    {
        public const string View = "project.view";
        public const string ManageBudget = "project.manage_budget"; // also covers creating customers/projects for now

        public const string SubmitExpense = "project.submit_expense";

        // Two-stage, but the "manager" here is whoever the specific project's own
        // ProjectManagerId points to — not the submitter's reporting manager.
        public const string ApproveExpenseAsProjectManager = "project.approve_expense_as_pm";
        public const string ApproveExpenseAsFinance = "project.approve_expense_as_finance";
    }

    public static class Sales
    {
        public const string View = "sales.view";
        public const string Manage = "sales.manage";
    }

    public static class Procurement
    {
        public const string View = "procurement.view";
        public const string Manage = "procurement.manage";
    }

    public static class Inventory
    {
        public const string View = "inventory.view";
        public const string Manage = "inventory.manage";
    }

    public static class Crm
    {
        public const string View = "crm.view";
        public const string Manage = "crm.manage";
    }

    public static class Admin
    {
        // Creating login accounts (HR/Manager by an Admin, Employee/Manager by HR) —
        // separate from People.Manage, which is about the employee record itself.
        public const string ManageUsers = "admin.manage_users";
        public const string ManageRoles = "admin.manage_roles";
        public const string ManageOrgStructure = "admin.manage_org_structure";
        public const string ViewAuditLog = "admin.view_audit_log";
    }

    // Admin-configurable report visibility: the base claim a role/user needs to even attempt
    // a given reportable surface (Team/Projects/Expenses reports, Finance's tenant-wide expense
    // view, the dashboard KPI row, HR's headcount/attendance trends). Holding the claim alone is
    // still gated by whatever permission that surface already borrowed (e.g. Leave.ApproveAsManager
    // for the Team report) — see ReportsController/DashboardController/SearchController. On top of
    // that, IReportAccessService can further narrow *which* roles/users/projects are actually
    // visible via ReportAccessGrant rows an Admin configures on the Report Access admin page.
    public static class Reports
    {
        public const string ViewTeam = "reports.view_team";
        public const string ViewProjects = "reports.view_projects";
        public const string ViewExpenses = "reports.view_expenses";
        public const string ViewFinance = "reports.view_expenses_all";
        public const string ViewDashboardKpis = "reports.view_dashboard_kpis";
        public const string ViewHrTrends = "reports.view_hr_trends";
    }

    // Platform-operator permissions — granted only to accounts in the reserved "platform"
    // tenant, never to a customer tenant. A SuperAdmin provisions new tenants and their
    // first Admin; everything below that line is the tenant's own business.
    public static class Platform
    {
        public const string ManageTenants = "platform.manage_tenants";
        public const string ManagePlans = "platform.manage_plans";
    }

    // Every permission key that a tenant's own roles can be granted, grouped by module —
    // built by reflection so a new Permission.* constant is automatically available to the
    // Roles admin UI the moment it's added here, with no second list to keep in sync.
    // Platform.* is excluded: those are reserved for the BAE operator tenant, never assignable
    // to a customer tenant's own roles.
    public static IReadOnlyList<(string Module, string Key)> Catalog()
    {
        var result = new List<(string, string)>();
        foreach (var module in typeof(Permission).GetNestedTypes())
        {
            if (module == typeof(Platform)) continue;
            foreach (var field in module.GetFields())
            {
                if (field.FieldType == typeof(string) && field.IsLiteral)
                {
                    result.Add((module.Name, (string)field.GetRawConstantValue()!));
                }
            }
        }
        return result;
    }
}

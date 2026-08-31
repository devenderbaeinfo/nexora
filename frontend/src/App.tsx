import { Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import RequireSuperAdmin from "./components/RequireSuperAdmin";
import Login from "./pages/Login";
import People from "./pages/People";
import PeopleOverview from "./pages/PeopleOverview";
import EmployeeProfile from "./pages/EmployeeProfile";
import ExpensesOverview from "./pages/ExpensesOverview";
import ProjectsOverview from "./pages/ProjectsOverview";
import ReportsOverview from "./pages/ReportsOverview";
import Timecard from "./pages/Timecard";
import Reimbursement from "./pages/Reimbursement";
import Projects from "./pages/Projects";
import Onboarding from "./pages/Onboarding";
import EmployeeDocuments from "./pages/EmployeeDocuments";
import Attendance from "./pages/Attendance";
import FnfSettlement from "./pages/FnfSettlement";
import Announcements from "./pages/Announcements";
import Dashboard from "./pages/Dashboard";
import MyTeam from "./pages/MyTeam";
import AllProjects from "./pages/AllProjects";
import CreateProject from "./pages/CreateProject";
import ProjectPlanning from "./pages/ProjectPlanning";
import ProjectTeam from "./pages/ProjectTeam";
import ProjectProgress from "./pages/ProjectProgress";
import ProjectBudget from "./pages/ProjectBudget";
import ProjectTasks from "./pages/ProjectTasks";
import MyProfile from "./pages/MyProfile";
import MyProjects from "./pages/MyProjects";
import MyExpenses from "./pages/MyExpenses";
import JobTitles from "./pages/JobTitles";
import Roles from "./pages/Roles";
import LeaveTypes from "./pages/LeaveTypes";
import AuditLog from "./pages/AuditLog";
import TimesheetApproval from "./pages/TimesheetApproval";
import ProjectProfitability from "./pages/ProjectProfitability";
import FinanceDashboard from "./pages/FinanceDashboard";
import Accounting from "./pages/Accounting";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import JournalEntries from "./pages/JournalEntries";
import GeneralLedger from "./pages/GeneralLedger";
import TrialBalance from "./pages/TrialBalance";
import ProfitAndLoss from "./pages/ProfitAndLoss";
import BalanceSheet from "./pages/BalanceSheet";
import CashFlow from "./pages/CashFlow";
import ProjectCost from "./pages/ProjectCost";
import FinanceProjects from "./pages/FinanceProjects";
import FinanceExpenseReports from "./pages/FinanceExpenseReports";
import MyTeamExpenses from "./pages/MyTeamExpenses";
import ExpenseApprovals from "./pages/ExpenseApprovals";
import MyApprovals from "./pages/MyApprovals";
import TeamReports from "./pages/TeamReports";
import ProjectReports from "./pages/ProjectReports";
import ExpenseReports from "./pages/ExpenseReports";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminClients from "./pages/admin/AdminClients";
import AdminSuperAdmins from "./pages/admin/AdminSuperAdmins";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminInvoices from "./pages/admin/AdminInvoices";
import AdminPayments from "./pages/admin/AdminPayments";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Client ERP shell — People, Timecard & Leave, Reimbursement, Project Expenses. */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<People />} />
        <Route path="people" element={<PeopleOverview />} />
        <Route path="people/:employeeId" element={<EmployeeProfile />} />
        <Route path="expenses" element={<ExpensesOverview />} />
        <Route path="projects-overview" element={<ProjectsOverview />} />
        <Route path="reports" element={<ReportsOverview />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="my-team" element={<MyTeam />} />
        <Route path="timecard" element={<Timecard />} />
        <Route path="reimbursement" element={<Reimbursement />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="my-time" element={<Attendance personalOnly />} />

        <Route path="projects" element={<AllProjects />} />
        <Route path="projects/create" element={<CreateProject />} />
        <Route path="projects/planning" element={<ProjectPlanning />} />
        <Route path="projects/team" element={<ProjectTeam />} />
        <Route path="projects/tasks" element={<ProjectTasks />} />
        <Route path="projects/mine" element={<MyProjects />} />
        <Route path="my-profile" element={<MyProfile />} />
        <Route path="my-expenses" element={<MyExpenses />} />
        <Route path="job-titles" element={<JobTitles />} />
        <Route path="roles" element={<Roles />} />
        <Route path="leave-types" element={<LeaveTypes />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="projects/progress" element={<ProjectProgress />} />
        <Route path="projects/budget" element={<ProjectBudget />} />
        <Route path="projects/profitability" element={<ProjectProfitability />} />
        <Route path="timesheets/approval" element={<TimesheetApproval />} />

        <Route path="finance/dashboard" element={<FinanceDashboard />} />
        <Route path="accounting" element={<Accounting />} />
        <Route path="accounting/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="accounting/journal-entries" element={<JournalEntries />} />
        <Route path="accounting/ledger" element={<GeneralLedger />} />
        <Route path="accounting/bank-cash" element={<GeneralLedger cashOnly />} />
        <Route path="accounting/trial-balance" element={<TrialBalance />} />
        <Route path="accounting/profit-and-loss" element={<ProfitAndLoss />} />
        <Route path="accounting/balance-sheet" element={<BalanceSheet />} />
        <Route path="accounting/cash-flow" element={<CashFlow />} />
        <Route path="projects/cost" element={<ProjectCost />} />
        <Route path="finance/projects" element={<FinanceProjects />} />
        <Route path="reports/expenses-all" element={<FinanceExpenseReports />} />
        <Route path="projects/expenses" element={<Projects />} />

        <Route path="expenses/team" element={<MyTeamExpenses />} />
        <Route path="expenses/approvals" element={<ExpenseApprovals />} />
        <Route path="approvals" element={<MyApprovals />} />

        <Route path="reports/team" element={<TeamReports />} />
        <Route path="reports/projects" element={<ProjectReports />} />
        <Route path="reports/expenses" element={<ExpenseReports />} />

        <Route path="onboarding" element={<Onboarding />} />
        <Route path="documents" element={<EmployeeDocuments />} />
        <Route path="fnf" element={<FnfSettlement />} />
        <Route path="announcements" element={<Announcements />} />
      </Route>

      {/* Platform control center — SuperAdmin only. Completely separate from the client
          ERP shell above: different layout, different nav, no client business data. */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireSuperAdmin>
              <AdminLayout />
            </RequireSuperAdmin>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="super-admins" element={<AdminSuperAdmins />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="payments" element={<AdminPayments />} />
      </Route>
    </Routes>
  );
}

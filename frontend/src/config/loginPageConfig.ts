// Single source of truth for every piece of copy, data, and configurable behavior on the
// login page — nothing user-visible on this page should be hardcoded inside a component.
// Change the product's name, hero copy, or demo dashboard numbers here only.

export interface DashboardStat {
  label: string;
  value: string;
  change: string;
}

export interface ActivityItem {
  title: string;
  time: string;
}

export const loginPageConfig = {
  branding: {
    name: "NEXORA",
    subtitle: "ERP SOLUTION",
  },

  login: {
    welcomeText: "Welcome back 👋",
    titlePrefix: "Sign in to your",
    titleHighlight: "NEXORA",
    description: "Secure access to your workspace and business applications.",
    emailLabel: "Email Address",
    emailPlaceholder: "you@company.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    rememberMeLabel: "Remember me",
    forgotPasswordLabel: "Forgot password?",
    // Kept as one config value rather than hardcoded in the JSX so the destination can
    // change (or point at a real route once a reset-password flow exists) from one place.
    forgotPasswordHref: "/forgot-password",
    buttonLabel: "Login",
    buttonLoadingLabel: "Signing in…",
    securityMessage: "Your data is protected with enterprise-grade security.",
    genericErrorMessage: "Invalid email or password.",
  },

  validation: {
    passwordMinLength: 8,
  },

  hero: {
    titleLine1: "Next-Generation",
    titleLine2: "Enterprise",
    titleLine3: "Operations.",
    description: "NEXORA unifies people, processes and performance — empowering you to work smarter and grow faster.",
    // Substrings of `description` rendered in the teal highlight color.
    highlightPhrases: ["work smarter", "grow faster"],
  },

  dashboardPreview: {
    browserLabel: "app.nexora.com",
    sidebarItems: ["Dashboard", "People", "Time", "Projects", "Expenses", "Accounting", "Reports", "Settings"],
    activeSidebarItem: "Dashboard",
    stats: [
      { label: "Total Employees", value: "248", change: "+12 this month" },
      { label: "Active Projects", value: "18", change: "+3 this month" },
      { label: "Total Expenses", value: "₹2.45L", change: "this quarter" },
    ] as DashboardStat[],
    budgetUsedPercent: 72,
    recentActivities: [
      { title: "Leave Request Approved", time: "2 min ago" },
      { title: "Expense Reimbursement", time: "18 min ago" },
      { title: "Project Budget Updated", time: "1 hr ago" },
    ] as ActivityItem[],
    securityBadgeLabel: "Enterprise secure",
  },
};

export type LoginPageConfig = typeof loginPageConfig;

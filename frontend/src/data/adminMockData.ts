// Mock data layer for the Super Admin platform-control-center area only.
// Every Super Admin page reads from here, never from hardcoded values in a component —
// swap any of these exports for a real `GET /api/admin/...` call later without touching the UI.

export interface KpiStat {
  label: string;
  value: string;
  change: string;
  changeTone: "good" | "warn" | "neutral";
  supportingText: string;
  icon: "clients" | "users" | "revenue" | "pending";
}

export const adminStats: KpiStat[] = [
  { label: "Total Clients", value: "24", change: "+12%", changeTone: "good", supportingText: "this month", icon: "clients" },
  { label: "Active Clients", value: "21", change: "87.5%", changeTone: "neutral", supportingText: "of total clients", icon: "clients" },
  { label: "Total Users", value: "1,248", change: "+9%", changeTone: "good", supportingText: "this month", icon: "users" },
  { label: "Active Users", value: "1,086", change: "87%", changeTone: "neutral", supportingText: "of total users", icon: "users" },
  { label: "Monthly Recurring Revenue", value: "₹4.85L", change: "+14%", changeTone: "good", supportingText: "this month", icon: "revenue" },
  { label: "Pending Payments", value: "₹1.20L", change: "6", changeTone: "warn", supportingText: "invoices pending", icon: "pending" },
];

export const revenueData: { month: string; value: number }[] = [
  { month: "Jan", value: 2.8 },
  { month: "Feb", value: 3.1 },
  { month: "Mar", value: 3.4 },
  { month: "Apr", value: 3.6 },
  { month: "May", value: 3.9 },
  { month: "Jun", value: 4.1 },
  { month: "Jul", value: 4.5 },
  { month: "Aug", value: 4.85 },
];

export const userGrowthData = {
  totalUsers: 1248,
  newThisMonth: 86,
  activeUsers: 1086,
  inactiveUsers: 162,
};

export const clientGrowthData = {
  total: 24,
  active: 21,
  trial: 2,
  inactive: 1,
};

export type ClientStatus = "Active" | "Trial" | "Inactive";
export type PlanName = "Starter" | "Professional" | "Enterprise";

export interface ClientRow {
  companyName: string;
  userCount: number;
  plan: PlanName;
  status: ClientStatus;
}

export const clients: ClientRow[] = [
  { companyName: "Acme Technologies", userCount: 248, plan: "Enterprise", status: "Active" },
  { companyName: "BAE Solutions", userCount: 126, plan: "Professional", status: "Active" },
  { companyName: "Vertex Industries", userCount: 184, plan: "Enterprise", status: "Active" },
  { companyName: "Nova Systems", userCount: 94, plan: "Starter", status: "Trial" },
  { companyName: "Global Tech Pvt Ltd", userCount: 156, plan: "Professional", status: "Active" },
  { companyName: "Orbit Manufacturing", userCount: 62, plan: "Starter", status: "Inactive" },
];

export interface Plan {
  name: PlanName;
  price: string; // pre-formatted so "Custom Pricing" fits the same field as "₹9,999 / month"
  maxUsers: string;
  modules: string[];
  subscriberCount: number;
  status: "Active" | "Deprecated";
}

export const plans: Plan[] = [
  {
    name: "Starter",
    price: "₹9,999 / month",
    maxUsers: "50",
    modules: ["People", "Timecard", "Leave"],
    subscriberCount: clients.filter((c) => c.plan === "Starter").length,
    status: "Active",
  },
  {
    name: "Professional",
    price: "₹24,999 / month",
    maxUsers: "250",
    modules: ["People", "Timecard", "Leave", "Reimbursement", "Projects"],
    subscriberCount: clients.filter((c) => c.plan === "Professional").length,
    status: "Active",
  },
  {
    name: "Enterprise",
    price: "Custom Pricing",
    maxUsers: "Unlimited",
    modules: ["People", "Timecard", "Leave", "Reimbursement", "Projects", "Accounting", "Advanced Reports"],
    subscriberCount: clients.filter((c) => c.plan === "Enterprise").length,
    status: "Active",
  },
];

export type SubscriptionStatus = "Active" | "Trial" | "Cancelled";

export interface Subscription {
  client: string;
  plan: PlanName;
  billing: string;
  status: SubscriptionStatus;
  renewal: string | null;
}

export const subscriptions: Subscription[] = [
  { client: "Acme Technologies", plan: "Enterprise", billing: "₹85,000/month", status: "Active", renewal: "12 Sep 2026" },
  { client: "BAE Solutions", plan: "Professional", billing: "₹24,999/month", status: "Active", renewal: "20 Sep 2026" },
  { client: "Vertex Industries", plan: "Enterprise", billing: "₹75,000/month", status: "Active", renewal: "28 Sep 2026" },
  { client: "Nova Systems", plan: "Starter", billing: "₹9,999/month", status: "Trial", renewal: null },
  { client: "Global Tech Pvt Ltd", plan: "Professional", billing: "₹24,999/month", status: "Active", renewal: "5 Oct 2026" },
  { client: "Orbit Manufacturing", plan: "Starter", billing: "₹9,999/month", status: "Cancelled", renewal: null },
];

export type InvoiceStatus = "Paid" | "Pending" | "Overdue";

export interface Invoice {
  id: string;
  client: string;
  amount: string;
  date: string;
  status: InvoiceStatus;
}

export const invoices: Invoice[] = [
  { id: "INV-1024", client: "Acme Technologies", amount: "₹85,000", date: "12 Aug 2026", status: "Paid" },
  { id: "INV-1025", client: "BAE Solutions", amount: "₹24,999", date: "15 Aug 2026", status: "Paid" },
  { id: "INV-1026", client: "Vertex Industries", amount: "₹75,000", date: "18 Aug 2026", status: "Pending" },
  { id: "INV-1027", client: "Nova Systems", amount: "₹9,999", date: "20 Aug 2026", status: "Pending" },
  { id: "INV-1028", client: "Global Tech Pvt Ltd", amount: "₹24,999", date: "22 Aug 2026", status: "Paid" },
  { id: "INV-1029", client: "Orbit Manufacturing", amount: "₹9,999", date: "1 Jul 2026", status: "Overdue" },
];

export const paymentSummary = {
  totalCollected: "₹4.20L",
  pending: "₹1.20L",
  overdue: "₹35,000",
  thisMonth: "₹4.85L",
};

export interface Payment {
  id: string;
  client: string;
  amount: string;
  date: string;
  status: "Success" | "Pending" | "Failed";
  method: string;
}

export const payments: Payment[] = [
  { id: "PAY-8841", client: "Acme Technologies", amount: "₹85,000", date: "12 Aug 2026", status: "Success", method: "Bank Transfer" },
  { id: "PAY-8842", client: "BAE Solutions", amount: "₹24,999", date: "15 Aug 2026", status: "Success", method: "Card" },
  { id: "PAY-8843", client: "Global Tech Pvt Ltd", amount: "₹24,999", date: "22 Aug 2026", status: "Success", method: "UPI" },
  { id: "PAY-8844", client: "Vertex Industries", amount: "₹75,000", date: "18 Aug 2026", status: "Pending", method: "Bank Transfer" },
  { id: "PAY-8845", client: "Nova Systems", amount: "₹9,999", date: "20 Aug 2026", status: "Pending", method: "Card" },
  { id: "PAY-8846", client: "Orbit Manufacturing", amount: "₹9,999", date: "1 Jul 2026", status: "Failed", method: "Card" },
];

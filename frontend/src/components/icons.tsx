import type { CSSProperties, ReactElement } from "react";

// A small hand-drawn icon set (no icon library dependency) — simple geometric strokes
// that inherit currentColor, so they automatically match each nav link's resting/active/
// hover ink color and both themes without any extra styling.
type IconProps = { size?: number; style?: CSSProperties };

function Svg({ size = 17, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export const GridIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
);
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" /><circle cx="17" cy="8.5" r="2.4" /><path d="M15.5 12.2c2.4.2 4.3 2.2 4.5 5.3" /></Svg>
);
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></Svg>
);
export const UserPlusIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="10" cy="8" r="3.2" /><path d="M3.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><path d="M18 8v5M15.5 10.5h5" /></Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><path d="m9 14 2 2 4-4.5" /></Svg>
);
export const FolderIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.2l2 2.2H19A1.5 1.5 0 0 1 20.5 8.7V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z" /></Svg>
);
export const PlusCircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></Svg>
);
export const CheckSquareIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="m8 12.5 2.5 2.5L16.5 9" /></Svg>
);
export const TrendingUpIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 17 10 10.5l3.5 3.5L20.5 6.5" /><path d="M15.5 6.5h5v5" /></Svg>
);
export const WalletIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="6.5" width="18" height="12.5" rx="2.2" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.2" /></Svg>
);
export const CreditCardIcon = (p: IconProps) => (
  <Svg {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2.2" /><path d="M2.5 10h19M6 14.5h4" /></Svg>
);
export const ShieldCheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z" /><path d="m9 12 2 2 4.5-4.5" /></Svg>
);
export const BarChartIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2.5 20h19" /></Svg>
);
export const BookIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 5.2c2.2-1 5-1.2 8 0v13.6c-3-1.2-5.8-1-8 0z" /><path d="M20 5.2c-2.2-1-5-1.2-8 0v13.6c3-1.2 5.8-1 8 0z" /></Svg>
);
export const LandmarkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 9.5 12 4l9 5.5" /><path d="M4.5 9.5v9M9 9.5v9M15 9.5v9M19.5 9.5v9" /><path d="M3 19.5h18" /></Svg>
);
export const FileTextIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6.5 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 6.5 3.5Z" /><path d="M14 3.5V8h4.3M8.5 12h7M8.5 15.5h7" /></Svg>
);
export const MegaphoneIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 9.5v5h3l7 4V5.5l-7 4z" /><path d="M17 9.2a4.5 4.5 0 0 1 0 5.6" /></Svg>
);
export const BriefcaseIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="7.5" width="18" height="11.5" rx="2" /><path d="M8.5 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2" /><path d="M3 12.5h18" /></Svg>
);
export const TagIcon = (p: IconProps) => (
  <Svg {...p}><path d="M11.5 3.5H6A2.5 2.5 0 0 0 3.5 6v5.5a1.5 1.5 0 0 0 .44 1.06l8 8a1.5 1.5 0 0 0 2.12 0l6.44-6.44a1.5 1.5 0 0 0 0-2.12l-8-8a1.5 1.5 0 0 0-1.06-.44Z" /><circle cx="8.2" cy="8.2" r="1.2" /></Svg>
);
export const ReceiptIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5.5 3.5h13v17l-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6z" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></Svg>
);
export const LayersIcon = (p: IconProps) => (
  <Svg {...p}><path d="m12 3.5 8.5 4.8L12 13.1 3.5 8.3z" /><path d="m3.5 12.7 8.5 4.8 8.5-4.8M3.5 16.9l8.5 4.8 8.5-4.8" /></Svg>
);
export const CircleIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /></Svg>
);
export const GearIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6.1 6.1l1.7 1.7M16.2 16.2l1.7 1.7M17.9 6.1l-1.7 1.7M7.8 16.2l-1.7 1.7" /></Svg>
);
export const TargetIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></Svg>
);
export const CartIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 4.5h2l2.4 11.2a1.8 1.8 0 0 0 1.76 1.4h7.4a1.8 1.8 0 0 0 1.76-1.4l1.4-7.2H6.5" /><circle cx="9.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></Svg>
);
export const BoxesIcon = (p: IconProps) => (
  <Svg {...p}><path d="m4 6.5 4-2.2 4 2.2-4 2.3z" /><path d="M4 6.5v5l4 2.3M12 8.8v5l4 2.3M8 8.8l4-2.3 4 2.3-4 2.3z" /><path d="M20 6.5v5l-4 2.3" /></Svg>
);
export const ContactCardIcon = (p: IconProps) => (
  <Svg {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><circle cx="9" cy="12" r="2.3" /><path d="M5.7 16.2c.5-1.7 1.8-2.6 3.3-2.6s2.8.9 3.3 2.6" /><path d="M14.5 9.5h4M14.5 13h4" /></Svg>
);

// Ordered by specificity, not alphabetically — the first regex that matches wins, so a
// narrow rule (e.g. "settlement") must sit above a broad one (e.g. bare "work") that would
// otherwise swallow it. Covers both the sidebar's NAV_MODULES labels (top-level module names
// like "Overview"/"Finance"/"Work"/"Settings" as well as every nested item label) and the
// Dashboard page's KPI/quick-action labels — both call iconForLabel with real, current label
// strings, not a fixed enum, so this list has to be kept in sync by hand when a label changes.
const RULES: [RegExp, (p: IconProps) => ReactElement][] = [
  [/dashboard|^overview$/i, GridIcon],
  [/my team|^team$|team size|assign employee/i, UsersIcon],
  [/employee/i, UsersIcon],
  [/my profile|^people$/i, UserIcon],
  [/onboarding/i, UserPlusIcon],
  [/attendance|my time|time card/i, ClockIcon],
  [/leave/i, CalendarIcon],
  [/settlement/i, BriefcaseIcon],
  [/all projects|project team|^projects$/i, FolderIcon],
  [/^create|new /i, PlusCircleIcon],
  [/task/i, CheckSquareIcon],
  [/progress|profitability/i, TrendingUpIcon],
  [/budget|my expenses|team expenses|payroll|payslip/i, WalletIcon],
  [/project expense|reimbursement|expense/i, CreditCardIcon],
  [/approv|verification|roles & permissions/i, ShieldCheckIcon],
  [/report|p&l|balance sheet|cash flow/i, BarChartIcon],
  [/chart of accounts|journal|ledger|trial balance/i, BookIcon],
  [/bank/i, LandmarkIcon],
  [/audit log/i, FileTextIcon],
  [/documents/i, FileTextIcon],
  [/announcement/i, MegaphoneIcon],
  [/^work$/i, BriefcaseIcon],
  [/job titles/i, TagIcon],
  [/accounting|payment|^finance$/i, LayersIcon],
  [/^settings$/i, GearIcon],
  [/lead|^sales/i, TargetIcon],
  [/purchase order|^procurement$/i, CartIcon],
  [/stock item|^inventory$/i, BoxesIcon],
  [/contact|^crm$/i, ContactCardIcon],
  // Broad fallback for any other project-flavored label (e.g. "Projects you manage",
  // "Project Planning", "My Projects", "Project Finance") — sits after every more specific
  // project rule above so those still win first.
  [/project/i, FolderIcon],
];

export function iconForLabel(label: string, size = 17): ReactElement {
  const match = RULES.find(([pattern]) => pattern.test(label));
  const Icon = match?.[1] ?? CircleIcon;
  return <Icon size={size} />;
}

const TONE_MAP: Record<string, [string, string]> = {
  Active: ["var(--good-soft)", "var(--good)"],
  Success: ["var(--good-soft)", "var(--good)"],
  Paid: ["var(--good-soft)", "var(--good)"],
  Trial: ["var(--warn-soft)", "var(--warn)"],
  Pending: ["var(--warn-soft)", "var(--warn)"],
  Inactive: ["var(--danger-soft)", "var(--danger)"],
  Cancelled: ["var(--danger-soft)", "var(--danger)"],
  Overdue: ["var(--danger-soft)", "var(--danger)"],
  Failed: ["var(--danger-soft)", "var(--danger)"],
  Deprecated: ["var(--surface-2)", "var(--faint)"],
};

export default function StatusBadge({ status }: { status: string }) {
  const [bg, fg] = TONE_MAP[status] ?? ["var(--surface-2)", "var(--muted)"];
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        background: bg, color: fg, padding: "3px 10px", borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

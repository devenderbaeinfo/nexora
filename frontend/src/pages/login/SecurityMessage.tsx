import { ShieldIcon } from "./DashboardPreview";

export default function SecurityMessage({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28, color: "var(--muted)", fontSize: 12.5 }}>
      <ShieldIcon size={15} color="var(--accent)" />
      <span>{text}</span>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface BillingProviderStatus {
  providerName: string;
  isConnected: boolean;
}

// PLT-5: today there's always exactly one answer ("Manual", not connected) — this banner
// exists so that the day a real processor is wired up behind IBillingProviderGateway, it
// shows up here with zero changes to this component.
export default function BillingProviderBanner() {
  const { data } = useQuery({
    queryKey: ["platform", "billing", "provider-status"],
    queryFn: async () => (await api.get<BillingProviderStatus>("/platform/billing/provider-status")).data,
  });

  if (!data) return null;

  return (
    <div style={styles.banner}>
      <span style={{ ...styles.dot, background: data.isConnected ? "var(--good)" : "var(--warn)" }} />
      Billing provider: <strong>{data.providerName}</strong>
      {!data.isConnected && " (not connected — payments are tracked and reconciled manually)"}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)",
    background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "8px 12px", marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
};

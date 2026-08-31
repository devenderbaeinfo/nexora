import { adminStats, revenueData, userGrowthData, clientGrowthData } from "../../data/adminMockData";
import KpiCard from "../../components/admin/KpiCard";
import AnalyticsChart from "../../components/admin/AnalyticsChart";
import { adminStyles as s } from "../../components/admin/adminStyles";

export default function AdminDashboard() {
  return (
    <div>
      <header style={s.header}>
        <h1 style={s.title}>Platform Control Center</h1>
        <p style={s.subtitle}>How the NEXORA platform is performing across every client — revenue, adoption, and billing health at a glance.</p>
      </header>

      <div style={s.kpiGrid}>
        {adminStats.map((stat) => <KpiCard stat={stat} key={stat.label} />)}
      </div>

      <div style={s.grid2}>
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Revenue Overview</h2>
          <p style={s.sectionSubtitle}>Monthly recurring revenue across all clients, in ₹ lakhs.</p>
          <div style={s.card}>
            <AnalyticsChart data={revenueData} />
          </div>
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>At a Glance</h2>
          <p style={s.sectionSubtitle}>See Analytics for the full breakdown.</p>
          <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 16 }}>
            <QuickStat label="New users this month" value={userGrowthData.newThisMonth} />
            <QuickStat label="Active users" value={userGrowthData.activeUsers} />
            <QuickStat label="Clients on trial" value={clientGrowthData.trial} />
            <QuickStat label="Inactive clients" value={clientGrowthData.inactive} />
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

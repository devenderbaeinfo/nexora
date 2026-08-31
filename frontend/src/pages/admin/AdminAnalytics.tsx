import { revenueData, userGrowthData, clientGrowthData } from "../../data/adminMockData";
import AnalyticsChart from "../../components/admin/AnalyticsChart";
import BreakdownBar from "../../components/admin/BreakdownBar";
import { adminStyles as s } from "../../components/admin/adminStyles";

export default function AdminAnalytics() {
  return (
    <div>
      <header style={s.header}>
        <h1 style={s.title}>Analytics</h1>
        <p style={s.subtitle}>Revenue trend, user adoption, and client growth across the platform.</p>
      </header>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Revenue Overview</h2>
        <p style={s.sectionSubtitle}>Monthly recurring revenue, ₹ lakhs.</p>
        <div style={s.card}>
          <AnalyticsChart data={revenueData} height={260} />
        </div>
        <div style={{ ...s.tableWrap, marginTop: 16 }}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Month</th><th style={s.th}>MRR</th></tr></thead>
            <tbody>
              {revenueData.map((row) => (
                <tr key={row.month}>
                  <td style={s.td}>{row.month}</td>
                  <td style={s.td}>₹{row.value.toFixed(2)}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div style={s.grid2}>
        <section style={s.section}>
          <h2 style={s.sectionTitle}>User Growth</h2>
          <p style={s.sectionSubtitle}>{userGrowthData.totalUsers.toLocaleString()} total users · {userGrowthData.newThisMonth} new this month</p>
          <div style={s.card}>
            <BreakdownBar
              total={userGrowthData.totalUsers}
              segments={[
                { label: "Active Users", value: userGrowthData.activeUsers, color: "#6D4AFF" },
                { label: "Inactive Users", value: userGrowthData.inactiveUsers, color: "#E6E1F2" },
              ]}
            />
          </div>
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>Client Growth</h2>
          <p style={s.sectionSubtitle}>{clientGrowthData.total} clients on the platform today</p>
          <div style={s.card}>
            <BreakdownBar
              total={clientGrowthData.total}
              segments={[
                { label: "Active", value: clientGrowthData.active, color: "#6D4AFF" },
                { label: "Trial", value: clientGrowthData.trial, color: "#12D6C5" },
                { label: "Inactive", value: clientGrowthData.inactive, color: "#E6E1F2" },
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

import { loginPageConfig } from "../../config/loginPageConfig";

// The entire mockup is real markup — grid, cards, and an SVG donut chart — so every number
// and label comes from loginPageConfig and can change without touching this file.
export default function DashboardPreview() {
  const cfg = loginPageConfig.dashboardPreview;
  const pct = Math.max(0, Math.min(100, cfg.budgetUsedPercent));
  const circumference = 2 * Math.PI * 26;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="bae-dashboard">
      <div className="bae-dashboard-titlebar">
        <span className="bae-dashboard-dot" style={{ background: "#EF4444" }} />
        <span className="bae-dashboard-dot" style={{ background: "#F59E0B" }} />
        <span className="bae-dashboard-dot" style={{ background: "#22C55E" }} />
        <span className="bae-dashboard-url">{cfg.browserLabel}</span>
      </div>

      <div className="bae-dashboard-body">
        <nav className="bae-dashboard-sidebar" aria-label="Dashboard preview navigation">
          {cfg.sidebarItems.map((item) => (
            <span
              key={item}
              className={"bae-dashboard-nav-item" + (item === cfg.activeSidebarItem ? " active" : "")}
            >
              {item}
            </span>
          ))}
        </nav>

        <div className="bae-dashboard-main">
          <div className="bae-stat-grid">
            {cfg.stats.map((stat) => (
              <div className="bae-stat-card" key={stat.label}>
                <div className="bae-stat-label">{stat.label}</div>
                <div className="bae-stat-value">{stat.value}</div>
                <div className="bae-stat-change">{stat.change}</div>
              </div>
            ))}
          </div>

          <div className="bae-dashboard-row">
            <div className="bae-activity-list">
              <div className="bae-activity-heading">Recent Activity</div>
              {cfg.recentActivities.map((activity) => (
                <div className="bae-activity-item" key={activity.title}>
                  <span className="title">{activity.title}</span>
                  <span className="time">{activity.time}</span>
                </div>
              ))}
            </div>

            <div className="bae-chart-card">
              <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${pct}% of project budget used`}>
                <circle cx="32" cy="32" r="26" fill="none" stroke="#292B3A" strokeWidth="7" />
                <circle
                  cx="32" cy="32" r="26" fill="none" stroke="#12D6C5" strokeWidth="7"
                  strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  transform="rotate(-90 32 32)"
                />
                <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="800" fill="#F5F3FF">
                  {pct}%
                </text>
              </svg>
              <div className="bae-chart-label">Project Budget Used</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShieldIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5l7.5 3.2v5.1c0 4.9-3.2 9.1-7.5 10.7-4.3-1.6-7.5-5.8-7.5-10.7V5.7L12 2.5z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none"
      />
      <path d="M8.7 12.2l2.3 2.3 4.3-4.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

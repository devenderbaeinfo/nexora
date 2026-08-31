import { subscriptions } from "../../data/adminMockData";
import StatusBadge from "../../components/admin/StatusBadge";
import { adminStyles as s } from "../../components/admin/adminStyles";

export default function AdminSubscriptions() {
  return (
    <div>
      <header style={s.header}>
        <h1 style={s.title}>Subscriptions</h1>
        <p style={s.subtitle}>Which plan each client is on, what they're billed, and when it renews.</p>
      </header>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Client</th>
              <th style={s.th}>Plan</th>
              <th style={s.th}>Billing</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.client}>
                <td style={s.td}><div style={{ fontWeight: 600, color: "var(--ink)" }}>{sub.client}</div></td>
                <td style={s.td}>{sub.plan}</td>
                <td style={s.td}>{sub.billing}</td>
                <td style={s.td}><StatusBadge status={sub.status} /></td>
                <td style={s.td}>{sub.renewal ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { paymentSummary, payments } from "../../data/adminMockData";
import StatusBadge from "../../components/admin/StatusBadge";
import { adminStyles as s } from "../../components/admin/adminStyles";

export default function AdminPayments() {
  const cards = [
    { label: "Total Collected", value: paymentSummary.totalCollected, color: "var(--good)" },
    { label: "Pending", value: paymentSummary.pending, color: "var(--warn)" },
    { label: "Overdue", value: paymentSummary.overdue, color: "var(--danger)" },
    { label: "This Month", value: paymentSummary.thisMonth, color: "var(--accent)" },
  ];

  return (
    <div>
      <header style={s.header}>
        <h1 style={s.title}>Payments</h1>
        <p style={s.subtitle}>High-level collection status across all clients.</p>
      </header>

      <div style={s.kpiGrid}>
        {cards.map((c) => (
          <div style={s.card} className="card-surface" key={c.label}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginBottom: 10 }}>{c.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Transactions</h2>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Payment ID</th>
                <th style={s.th}>Client</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Method</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...s.td, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{p.id}</td>
                  <td style={s.td}><div style={{ fontWeight: 600, color: "var(--ink)" }}>{p.client}</div></td>
                  <td style={s.td}>{p.amount}</td>
                  <td style={s.td}>{p.date}</td>
                  <td style={s.td}><StatusBadge status={p.status} /></td>
                  <td style={s.td}>{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

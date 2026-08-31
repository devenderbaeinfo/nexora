import { invoices } from "../../data/adminMockData";
import StatusBadge from "../../components/admin/StatusBadge";
import { adminStyles as s } from "../../components/admin/adminStyles";

export default function AdminInvoices() {
  return (
    <div>
      <header style={s.header}>
        <h1 style={s.title}>Invoices</h1>
        <p style={s.subtitle}>Every invoice issued to a client, and whether it's been paid.</p>
      </header>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Invoice</th>
              <th style={s.th}>Client</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Date</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td style={{ ...s.td, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{inv.id}</td>
                <td style={s.td}><div style={{ fontWeight: 600, color: "var(--ink)" }}>{inv.client}</div></td>
                <td style={s.td}>{inv.amount}</td>
                <td style={s.td}>{inv.date}</td>
                <td style={s.td}><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

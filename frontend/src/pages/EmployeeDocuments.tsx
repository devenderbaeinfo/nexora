import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface EmployeeDocumentRow {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  expiresOn: string | null;
  createdAtUtc: string;
}

interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
}

const DOCUMENT_TYPES = ["OfferLetter", "IdProof", "Contract", "Certificate", "Other"];

export default function EmployeeDocuments() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("employee_docs.manage");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<EmployeeListItem[]>("/employees")).data,
    enabled: canManage,
  });

  const documents = useQuery({
    queryKey: ["employee-documents", canManage ? selectedEmployeeId : "mine"],
    queryFn: async () => {
      const url = canManage
        ? `/employee-documents/employees/${selectedEmployeeId}`
        : "/employee-documents/mine";
      return (await api.get<EmployeeDocumentRow[]>(url)).data;
    },
    enabled: canManage ? !!selectedEmployeeId : true,
  });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileInputRef.current?.files?.[0];
      if (!file || !selectedEmployeeId) throw new Error("Pick an employee and a file first.");
      const form = new FormData();
      form.append("employeeId", selectedEmployeeId);
      form.append("type", docType);
      form.append("file", file);
      return api.post("/employee-documents", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
    },
  });

  const verify = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/employee-documents/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-documents"] }),
  });

  const download = async (doc: EmployeeDocumentRow) => {
    const res = await api.get(`/employee-documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.originalFileName;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Employee Documents</h1>
          <p style={styles.subtitle}>
            {canManage
              ? "Upload and verify documents for any employee in your organization."
              : "Documents HR has on file for you."}
          </p>
        </div>
      </header>

      {canManage && (
        <section style={styles.uploadCard} className="card-surface">
          <div style={styles.uploadRow}>
            <select style={styles.select} value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.data?.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
            <select style={styles.select} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={styles.fileInput} />
            <button
              style={styles.addButton}
              disabled={!selectedEmployeeId || upload.isPending}
              onClick={() => upload.mutate()}
            >
              Upload
            </button>
          </div>
          {upload.isError && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
              {(upload.error as any)?.response?.data ?? (upload.error as Error).message}
            </p>
          )}
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{canManage ? "Documents on file" : "My documents"}</h2>
        {canManage && !selectedEmployeeId && (
          <p style={{ color: "var(--muted)" }}>Select an employee above to see their documents.</p>
        )}
        {(!canManage || selectedEmployeeId) && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>File</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Expires</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {(!documents.data || documents.data.length === 0) && (
                  <tr><td style={styles.td} colSpan={5}>No documents yet.</td></tr>
                )}
                {documents.data?.map((d) => (
                  <tr key={d.id}>
                    <td style={styles.td}>{d.originalFileName}</td>
                    <td style={styles.td}>{d.type}</td>
                    <td style={styles.td}>{d.expiresOn ?? "—"}</td>
                    <td style={styles.td}><StatusTag status={d.status} /></td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={styles.secondary} onClick={() => download(d)}>Download</button>
                        {canManage && d.status !== "Verified" && (
                          <button style={styles.approve} onClick={() => verify.mutate({ id: d.id, status: "Verified" })}>Verify</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const palette: Record<string, [string, string]> = {
    Verified: ["var(--good-soft)", "var(--good)"],
    Pending: ["var(--warn-soft)", "var(--warn)"],
    Expired: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, fg] = palette[status] ?? palette.Pending;
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: bg, color: fg, padding: "3px 9px", borderRadius: 20 }}>{status}</span>;
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 600, marginBottom: 6 },
  subtitle: { color: "var(--muted)", fontSize: 14, margin: 0, maxWidth: 480 },
  uploadCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
    padding: 16, marginBottom: 28, boxShadow: "var(--shadow)",
  },
  uploadRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  select: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--ink)",
  },
  fileInput: { fontSize: 13, color: "var(--ink)" },
  addButton: {
    background: "var(--accent)", color: "var(--accent-ink)", border: "none",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, padding: "10px 16px",
    borderRadius: "var(--radius)", cursor: "pointer", whiteSpace: "nowrap",
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 12, color: "var(--ink)" },
  tableWrap: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", overflow: "auto", boxShadow: "var(--shadow)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 10.5,
    letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)",
    padding: "12px 16px", borderBottom: "1px solid var(--border-strong)", background: "var(--surface-2)",
  },
  td: { padding: "13px 16px", borderBottom: "1px solid var(--border)" },
  approve: {
    background: "var(--good-soft)", color: "var(--good)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
  secondary: {
    background: "var(--surface-sunken)", color: "var(--muted)", border: "none",
    fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: "var(--radius)", cursor: "pointer",
  },
};

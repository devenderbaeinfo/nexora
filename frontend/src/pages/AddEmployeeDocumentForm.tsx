import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formStyles as s } from "../components/formStyles";

const DOCUMENT_TYPES = ["OfferLetter", "IdProof", "Contract", "Certificate", "Other"];

// Same upload endpoint EmployeeDocuments.tsx uses, scoped to one already-known employee —
// no employee picker needed since this only ever opens from that employee's own profile.
export default function AddEmployeeDocumentForm({ employeeId, onDone }: { employeeId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileInputRef.current?.files?.[0];
      if (!file) throw new Error("Choose a file first.");
      const form = new FormData();
      form.append("employeeId", employeeId);
      form.append("type", docType);
      form.append("file", file);
      return api.post("/employee-documents", form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      onDone();
    },
    onError: (err: any) => setError(err?.response?.data ?? (err as Error).message ?? "Couldn't upload this document."),
  });

  return (
    <div>
      <label style={s.label} htmlFor="docType">Document type</label>
      <select id="docType" style={s.field} value={docType} onChange={(e) => setDocType(e.target.value)}>
        {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <label style={s.label} htmlFor="docFile">File</label>
      <input id="docFile" ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={s.field} />

      {error && <div style={s.error} role="alert">{String(error)}</div>}

      <div style={s.actions}>
        <button type="button" style={s.buttonSecondary} onClick={onDone}>Cancel</button>
        <button type="button" style={s.button} disabled={upload.isPending} onClick={() => upload.mutate()}>
          {upload.isPending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "../lib/api";

// Every approval queue in the app (leave, timesheet, reimbursement, project expense) exposes
// the same POST /{resource}/{id}/decision endpoint, so bulk approve/reject is just firing that
// same call per selected id in parallel — no new backend endpoint needed.
export function useBulkDecision(pathPrefix: string, invalidateKey: QueryKey) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = (ids: string[]) => setSelected((prev) =>
    ids.length > 0 && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids)
  );

  const clear = () => setSelected(new Set());

  const bulkDecide = useMutation({
    mutationFn: async ({ approve, note }: { approve: boolean; note?: string }) => {
      const ids = Array.from(selected);
      await Promise.all(ids.map((id) => api.post(`${pathPrefix}/${id}/decision`, { approve, note })));
    },
    onSuccess: () => {
      clear();
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  return { selected, toggle, toggleAll, clear, bulkDecide };
}

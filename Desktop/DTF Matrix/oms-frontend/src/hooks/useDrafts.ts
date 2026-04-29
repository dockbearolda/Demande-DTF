import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Backend record — opaque payload + summary fields surfaced in the listing. */
export interface DraftSummary {
  id: string;
  client_name: string | null;
  item_count: number;
  reference_count: number;
  last_step: number;
  quote_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftRead extends DraftSummary {
  payload: Record<string, unknown>;
}

export interface DraftUpsertBody {
  payload: Record<string, unknown>;
  client_name: string | null;
  item_count: number;
  reference_count: number;
  last_step: number;
  quote_id: string | null;
}

const STALE_MS = 5_000;

export function useDrafts() {
  return useQuery<DraftSummary[]>({
    queryKey: ["drafts"],
    queryFn: async () => {
      const res = await api.get<DraftSummary[]>("/drafts");
      return res.data;
    },
    staleTime: STALE_MS,
  });
}

export function useDraft(id: string | undefined) {
  return useQuery<DraftRead>({
    queryKey: ["drafts", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<DraftRead>(`/drafts/${id}`);
      return res.data;
    },
    // Drafts are personal scratchpads — never share them across the cache.
    staleTime: 0,
  });
}

export function useUpsertDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; body: DraftUpsertBody }) => {
      const res = await api.put<DraftRead>(`/drafts/${vars.id}`, vars.body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/drafts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

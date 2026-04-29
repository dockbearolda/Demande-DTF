import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BAT, BatStatus } from "@/lib/types";

export interface BatSearchResult {
  id: string;
  order_id: string;
  order_reference: string;
  client_id: string;
  client_name: string;
  file_name: string;
  file_type: string;
  status: BatStatus;
  version: number;
  model_reference: string | null;
  color_id: string | null;
  created_at: string;
  decided_at: string | null;
  file_url: string;
  usage_count: number;
}

export interface BatSearchParams {
  client_id?: string | null;
  model_reference?: string | null;
  color_id?: string | null;
  query?: string;
  days?: number;
  limit?: number;
  enabled?: boolean;
}

/**
 * Search existing BATs eligible for reuse on a new order. By default scoped
 * to the supplied client (most common path). Pass enabled:false to suspend.
 */
export function useSearchBats(params: BatSearchParams) {
  const { enabled = true, ...filters } = params;
  return useQuery<BatSearchResult[]>({
    queryKey: [
      "bats",
      "search",
      filters.client_id ?? null,
      filters.model_reference ?? null,
      filters.color_id ?? null,
      filters.query ?? "",
      filters.days ?? 365,
    ],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (filters.client_id) search.set("client_id", filters.client_id);
      if (filters.model_reference)
        search.set("model_reference", filters.model_reference);
      if (filters.color_id) search.set("color_id", filters.color_id);
      if (filters.query) search.set("query", filters.query);
      if (filters.days) search.set("days", String(filters.days));
      if (filters.limit) search.set("limit", String(filters.limit));
      const qs = search.toString();
      const res = await api.get<BatSearchResult[]>(
        `/bat/search/list${qs ? `?${qs}` : ""}`,
      );
      return res.data;
    },
  });
}

export interface BatLinkRequest {
  source_bat_id: string;
  target_order_id: string;
  color_id?: string | null;
  model_reference?: string | null;
}

/** Re-use an existing BAT for a freshly-created order. */
export function useLinkBat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: BatLinkRequest) => {
      const res = await api.post<BAT>("/bat/link", vars);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bats"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
}

export function useBatsForOrder(orderId: string | undefined) {
  return useQuery<BAT[]>({
    queryKey: ["bats", "order", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const res = await api.get<BAT[]>(`/bat/order/${orderId}`);
      return res.data;
    },
  });
}

export const useBatsList = useBatsForOrder;

export function useBat(batId: string | undefined) {
  return useQuery<BAT>({
    queryKey: ["bats", "detail", batId],
    enabled: !!batId,
    queryFn: async () => {
      const res = await api.get<BAT>(`/bat/${batId}`);
      return res.data;
    },
  });
}

export const useLoadBat = useBat;

export interface BatUploadResponse {
  bat_id: string;
  validation_url: string;
  expires_at: string;
}

export function useUploadBat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      order_id: string;
      file: File;
      message?: string;
      composition?: Record<string, unknown>;
      /** Identifies the (model × color) group this BAT belongs to. Used for
       *  server-side version chaining. Optional for legacy single-BAT uploads. */
      model_reference?: string;
      color_id?: string;
    }) => {
      const form = new FormData();
      form.append("order_id", vars.order_id);
      form.append("file", vars.file);
      if (vars.message) form.append("message", vars.message);
      if (vars.composition) form.append("composition", JSON.stringify(vars.composition));
      if (vars.model_reference) form.append("model_reference", vars.model_reference);
      if (vars.color_id) form.append("color_id", vars.color_id);
      const res = await api.post<BatUploadResponse>("/bat/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bats"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
}

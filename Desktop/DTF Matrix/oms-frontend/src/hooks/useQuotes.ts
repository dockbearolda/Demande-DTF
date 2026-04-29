/**
 * Hooks React Query pour les devis (Quote, étape 5A).
 *
 * Le backend (POST /quotes) recalcule lui-même les montants via le moteur
 * pricing — on lui envoie l'état du store frontend, il renvoie le devis
 * persisté avec son snapshot figé.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LogoPlacement } from "@/features/pricing";

export type QuoteStatus = "draft" | "on_hold" | "sent" | "converted";

export interface QuoteClientSummary {
  id: string;
  nom: string;
  email: string | null;
}

export interface QuoteListItem {
  id: string;
  reference: string;
  client: QuoteClientSummary;
  model_ref: string;
  quantity: number;
  snapshot_total_ttc: number;
  status: QuoteStatus;
  created_at: string;
}

export interface QuoteRead extends QuoteListItem {
  client_id: string;
  matrix_name: string;
  placements: string[];
  transport_active: boolean;
  tgca_active: boolean;
  discount: number;
  notes: string | null;
  snapshot_sous_total_ht: number;
  snapshot_montant_tgca: number;
  snapshot_transport_ttc: number;
  snapshot_total_avant_remise: number;
  snapshot_palier_applique: number | null;
  snapshot_payload: Record<string, unknown>;
  updated_at: string;
}

export interface QuoteCreatePayload {
  client_id: string;
  model_ref: string;
  quantity: number;
  placements: readonly LogoPlacement[];
  transport_active: boolean;
  tgca_active: boolean;
  discount: number;
  notes: string | null;
  matrix_name?: string;
}

const STALE_MS = 30_000;

export function useQuotes(statusFilter?: QuoteStatus) {
  return useQuery<QuoteListItem[]>({
    queryKey: ["quotes", { status: statusFilter ?? "all" }],
    queryFn: async () => {
      const res = await api.get<QuoteListItem[]>("/quotes", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      return res.data;
    },
    staleTime: STALE_MS,
  });
}

export function useQuote(id: string | null) {
  return useQuery<QuoteRead>({
    queryKey: ["quotes", id],
    enabled: id !== null,
    queryFn: async () => {
      const res = await api.get<QuoteRead>(`/quotes/${id}`);
      return res.data;
    },
    staleTime: STALE_MS,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: QuoteCreatePayload) => {
      const res = await api.post<QuoteRead>("/quotes", payload);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: QuoteStatus }) => {
      const res = await api.patch<QuoteRead>(`/quotes/${vars.id}/status`, {
        status: vars.status,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/quotes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

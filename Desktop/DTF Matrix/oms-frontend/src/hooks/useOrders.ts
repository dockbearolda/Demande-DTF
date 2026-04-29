import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AssignedTo,
  Order,
  OrderFilters,
  OrderStatus,
  Secteur,
} from "@/lib/types";

/**
 * Body accepted by `PUT /orders/{id}`. Mirrors `OrderUpdate` on the backend:
 * every header field is optional, and `lines` (when provided) replaces the
 * full set of lines for the order. Leave `lines` undefined to keep them
 * untouched.
 */
export interface OrderUpdatePayload {
  reference?: string;
  montant_total?: number | string;
  date_livraison_prevue?: string | null;
  is_urgent?: boolean;
  assigned_to?: AssignedTo | null;
  personne_contact?: string | null;
  telephone?: string | null;
  notes?: string | null;
  notes_globales?: string | null;
  lines?: Array<{
    ligne_numero: number;
    secteur: Secteur;
    produit: string;
    quantite: number;
    prix_unitaire: number | string;
    notes?: string | null;
  }>;
}

const STALE_MS = 30_000;

function paramsFrom(filters: OrderFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (filters.statut) out.statut = filters.statut;
  if (filters.client_id) out.client_id = filters.client_id;
  if (filters.date_from) out.date_from = filters.date_from;
  if (filters.date_to) out.date_to = filters.date_to;
  if (typeof filters.skip === "number") out.skip = filters.skip;
  if (typeof filters.limit === "number") out.limit = filters.limit;
  return out;
}

export function useOrders(filters: OrderFilters = {}) {
  return useQuery<Order[]>({
    queryKey: ["orders", filters],
    queryFn: async () => {
      const res = await api.get<Order[]>("/orders", { params: paramsFrom(filters) });
      return res.data;
    },
    staleTime: STALE_MS,
    // Keep showing the previous page's data while a filter change refetches.
    // Eliminates the "blank list → fade in" flicker when toggling status,
    // assignee, or pagination — the new data simply replaces the previous
    // when ready.
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery<Order>({
    queryKey: ["orders", "detail", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<Order>(`/orders/${id}`);
      return res.data;
    },
    staleTime: STALE_MS,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; statut: OrderStatus }) => {
      const res = await api.patch<Order>(`/orders/${vars.id}/status`, {
        statut: vars.statut,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/orders/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}

/**
 * Update header fields and (optionally) replace all lines on an existing order.
 * Backed by `PUT /orders/{id}` — see `OrderUpdatePayload` for the shape.
 */
export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; data: OrderUpdatePayload }) => {
      const res = await api.put<Order>(`/orders/${vars.id}`, vars.data);
      return res.data;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      // Prime the detail cache so the drawer doesn't flicker after save.
      qc.setQueryData(["orders", "detail", updated.id], updated);
    },
  });
}

/** Payload envoyé à `POST /orders` — miroir de `OrderCreate` côté backend.
 *  Volontairement permissif sur `lines[].variants` / `artworks` (formes
 *  polymorphes — textile vs classic) : c'est `OrderForm.buildOrderLinesPayload`
 *  qui garantit la cohérence avant l'appel.
 *
 *  `assigned_to` reste typé `string` (et non `AssignedTo`) pour absorber le
 *  drift connu entre `OperatorValue` (4 valeurs L/C/M/A) et `AssignedTo`
 *  (3 valeurs L/C/M) — le backend renvoie 422 si la valeur n'est pas dans
 *  son enum, ce qui est la garde fonctionnelle.
 */
export interface OrderCreatePayload {
  client_id: string;
  reference: string;
  assigned_to?: string | null;
  personne_contact?: string | null;
  telephone?: string | null;
  date_livraison_prevue?: string | null;
  is_urgent?: boolean;
  notes?: string | null;
  notes_globales?: string | null;
  statut?: OrderStatus;
  montant_total?: number | string;
  lines: Array<Record<string, unknown>>;
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: OrderCreatePayload) => {
      const res = await api.post<Order>("/orders", data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}

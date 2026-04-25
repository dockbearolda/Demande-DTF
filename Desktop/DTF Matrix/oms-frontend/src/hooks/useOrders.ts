import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Order, OrderFilters, OrderStatus } from "@/lib/types";

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

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
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

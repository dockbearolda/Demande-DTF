import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { KanbanBoard, Order, OrderStatus } from "@/lib/types";

const STALE_MS = 30_000;

export function useKanbanBoard() {
  return useQuery<KanbanBoard>({
    queryKey: ["kanban", "board"],
    queryFn: async () => {
      const res = await api.get<KanbanBoard>("/kanban/board");
      return res.data;
    },
    staleTime: STALE_MS,
  });
}

interface TransitionVars {
  order_id: string;
  to_status: OrderStatus;
  comment?: string;
}

interface TransitionResponse {
  order: Order;
  from_status: OrderStatus;
  to_status: OrderStatus;
  webhook_emitted: boolean;
}

export function useKanbanTransition() {
  const qc = useQueryClient();
  return useMutation<TransitionResponse, unknown, TransitionVars>({
    mutationFn: async (vars) => {
      const res = await api.post<TransitionResponse>("/kanban/transition", vars);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}

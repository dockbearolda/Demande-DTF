import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { KanbanMetrics } from "@/lib/types";

export function useMetrics() {
  return useQuery<KanbanMetrics>({
    queryKey: ["metrics", "kanban"],
    queryFn: async () => {
      const res = await api.get<KanbanMetrics>("/kanban/metrics");
      return res.data;
    },
    staleTime: 30_000,
  });
}

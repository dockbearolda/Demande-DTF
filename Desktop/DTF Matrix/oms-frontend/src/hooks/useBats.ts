import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BAT, BatComposition } from "@/lib/types";

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
      composition?: BatComposition;
    }) => {
      const form = new FormData();
      form.append("order_id", vars.order_id);
      form.append("file", vars.file);
      if (vars.message) form.append("message", vars.message);
      if (vars.composition) form.append("composition", JSON.stringify(vars.composition));
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

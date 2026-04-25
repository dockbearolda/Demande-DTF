import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";

const STALE_MS = 60_000;

export interface ClientInput {
  nom: string;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
}

export function useClients(search?: string) {
  return useQuery<Client[]>({
    queryKey: ["clients", { search: search ?? "" }],
    queryFn: async () => {
      const res = await api.get<Client[]>("/clients", {
        params: search ? { search } : undefined,
      });
      return res.data;
    },
    staleTime: STALE_MS,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ClientInput) => {
      const res = await api.post<Client>("/clients", payload);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; payload: ClientInput }) => {
      const res = await api.put<Client>(`/clients/${vars.id}`, vars.payload);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

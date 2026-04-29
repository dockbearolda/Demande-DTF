import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Client, ClientContact } from "@/lib/types";
import { logger } from "@/lib/logger";

const STALE_MS = 60_000;
// Max value accepted by the backend (`limit ≤ 500`, see app/routes/clients.py).
// We always request the full window so the local combobox / lookup maps don't
// silently miss older records — pagination would defeat fuzzy search.
const FETCH_LIMIT = 500;

export interface ClientInput {
  nom: string;
  nom_facture?: string | null;
  contact?: string | null;
  ville?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
}

export interface ClientContactInput {
  nom: string;
  telephone?: string | null;
  email?: string | null;
}

export interface ClientImportRow {
  nom: string;
  contact?: string | null;
  ville?: string | null;
  email?: string | null;
  telephone?: string | null;
}

export function useClients(search?: string) {
  return useQuery<Client[]>({
    queryKey: ["clients", { search: search ?? "" }],
    queryFn: async () => {
      const res = await api.get<Client[]>("/clients", {
        params: { limit: FETCH_LIMIT, ...(search ? { search } : {}) },
      });
      // Garde-fou : si la fenêtre max est saturée, la combobox manquera des
      // fiches récentes. Log dev — la migration vers une recherche serveur
      // (paginée) deviendra nécessaire quand la base dépassera cette taille.
      if (res.data.length >= FETCH_LIMIT) {
        logger.warn(
          `useClients: ${FETCH_LIMIT} fiches reçues — certains clients peuvent manquer dans la combobox locale.`,
        );
      }
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

export function useImportClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ClientImportRow[]) => {
      const res = await api.post<{
        clients_created: number;
        clients_skipped: number;
        contacts_created: number;
      }>("/clients/bulk-import", rows);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useAddContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ClientContactInput) => {
      const res = await api.post<ClientContact>(
        `/clients/${clientId}/contacts`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; payload: ClientContactInput }) => {
      const res = await api.put<ClientContact>(
        `/clients/${clientId}/contacts/${vars.id}`,
        vars.payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      await api.delete(`/clients/${clientId}/contacts/${contactId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

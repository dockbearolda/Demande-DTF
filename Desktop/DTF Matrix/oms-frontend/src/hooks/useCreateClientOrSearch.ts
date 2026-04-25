import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ClientResponse {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created: boolean;
}

export function useSearchOrCreateClient() {
  return useMutation({
    mutationFn: async (nom: string): Promise<ClientResponse> => {
      const res = await api.post<ClientResponse>(
        "/clients/search-or-create",
        { nom }
      );
      return res.data;
    },
  });
}

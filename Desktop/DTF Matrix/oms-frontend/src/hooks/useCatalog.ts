import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CatalogFamily,
  CatalogProduct,
  CatalogSubfamily,
  CatalogTree,
  PricingMatrix,
} from "@/lib/catalog";

const STALE_MS = 60_000;
const KEY = ["catalog", "tree"] as const;

export function useCatalogTree() {
  return useQuery<CatalogTree>({
    queryKey: KEY,
    queryFn: async () => (await api.get<CatalogTree>("/catalog/tree")).data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
  });
}

export interface CatalogIndex {
  productById: Map<string, CatalogProduct>;
  subfamilyById: Map<string, CatalogSubfamily>;
  familyById: Map<string, CatalogFamily>;
  matrixById: Map<string, PricingMatrix>;
  familyOfProduct: Map<string, CatalogFamily>;
}

export function useCatalogIndex(): { tree: CatalogTree | undefined; index: CatalogIndex } {
  const { data: tree } = useCatalogTree();
  const index = useMemo<CatalogIndex>(() => {
    const productById = new Map<string, CatalogProduct>();
    const subfamilyById = new Map<string, CatalogSubfamily>();
    const familyById = new Map<string, CatalogFamily>();
    const matrixById = new Map<string, PricingMatrix>();
    const familyOfProduct = new Map<string, CatalogFamily>();
    if (tree) {
      for (const m of tree.pricing_matrices) matrixById.set(m.id, m);
      for (const fam of tree.families) {
        familyById.set(fam.id, fam);
        for (const sf of fam.subfamilies) {
          subfamilyById.set(sf.id, sf);
          for (const p of sf.products) {
            productById.set(p.id, p);
            familyOfProduct.set(p.id, fam);
          }
        }
      }
    }
    return { productById, subfamilyById, familyById, matrixById, familyOfProduct };
  }, [tree]);
  return { tree, index };
}

// ───────── Mutations ─────────

interface FamilyPayload {
  slug: string;
  label: string;
  icon?: string;
  position?: number;
  enabled?: boolean;
}

interface SubfamilyPayload {
  slug: string;
  label: string;
  target?: string | null;
  position?: number;
  enabled?: boolean;
}

interface ProductPayload {
  reference: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  pricing_matrix_id?: string | null;
  position?: number;
  enabled?: boolean;
  colors: { id: string; label: string; hex: string; swatchBorder?: boolean }[];
  sizes: { id: string; label: string; order: number }[];
}

interface MatrixPayload {
  name: string;
  currency?: string;
  tiers: { minQty: number; vierge: number; coeur: number; dos: number }[];
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: FamilyPayload) =>
      (await api.post<CatalogFamily>("/catalog/families", payload)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<FamilyPayload> }) =>
      (await api.patch<CatalogFamily>(`/catalog/families/${vars.id}`, vars.patch)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/catalog/families/${id}`);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateSubfamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { familyId: string; payload: SubfamilyPayload }) =>
      (
        await api.post<CatalogSubfamily>(
          `/catalog/families/${vars.familyId}/subfamilies`,
          vars.payload,
        )
      ).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateSubfamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<SubfamilyPayload> }) =>
      (await api.patch<CatalogSubfamily>(`/catalog/subfamilies/${vars.id}`, vars.patch)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteSubfamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/catalog/subfamilies/${id}`);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { subfamilyId: string; payload: ProductPayload }) =>
      (
        await api.post<CatalogProduct>(
          `/catalog/subfamilies/${vars.subfamilyId}/products`,
          vars.payload,
        )
      ).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<ProductPayload> }) =>
      (await api.patch<CatalogProduct>(`/catalog/products/${vars.id}`, vars.patch)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/catalog/products/${id}`);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useCreatePricingMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MatrixPayload) =>
      (await api.post<PricingMatrix>("/catalog/pricing-matrices", payload)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdatePricingMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<MatrixPayload> }) =>
      (
        await api.patch<PricingMatrix>(`/catalog/pricing-matrices/${vars.id}`, vars.patch)
      ).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePricingMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/catalog/pricing-matrices/${id}`);
    },
    onSuccess: () => invalidate(qc),
  });
}

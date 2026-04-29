/**
 * Fetches `/catalog/supplier/tree` and registers every supplier model in the
 * runtime catalog so legacy `getTextileModel(id)` lookups resolve them.
 *
 * Mount this hook once near the app root (we wire it from new-order/index.ts
 * via a small bootstrap component) — it then powers every consumer.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/api";
import { supplierToTextileModel } from "@/features/new-order/supplierAdapter";
import {
  getAllTextileModels,
  registerTextileModels,
  subscribeRuntimeCatalog,
} from "@/features/new-order/runtimeCatalog";

// ─── DTO types — mirror app/schemas/supplier_catalog.py ────────────

export interface SupplierMockupDTO {
  id: string;
  view: string;
  url: string;
  ext: string;
  width: number | null;
  height: number | null;
  is_lifestyle: boolean;
}

export interface SupplierColorDTO {
  id: string;
  slug: string;
  label: string;
  hex: string | null;
  position: number;
  enabled: boolean;
  mockups: SupplierMockupDTO[];
}

export interface SupplierModelDTO {
  id: string;
  ref_internal: string;
  ref_supplier: string;
  ref_label: string;
  category: "HOMME" | "FEMME" | "ENFANT" | "BEBE" | string;
  brand: string | null;
  name: string | null;
  fit_type: string | null;
  fabric_composition: string | null;
  fabric_weight_gsm: number | null;
  position: number;
  enabled: boolean;
  colors: SupplierColorDTO[];
}

export interface SupplierCategoryGroupDTO {
  category: string;
  label: string;
  models: SupplierModelDTO[];
}

export interface SupplierCatalogTreeDTO {
  categories: SupplierCategoryGroupDTO[];
  total_models: number;
  total_colors: number;
  total_mockups: number;
  generated_at: string;
}

const KEY = ["supplier-catalog", "tree"] as const;
const STALE_MS = 5 * 60_000;

/**
 * Resolve a relative mockup URL (e.g. `/static/supplier-mockups/...`) against
 * the API base URL so `<img src>` loads cross-origin in dev. Absolute URLs
 * (CDN, presigned S3) are passed through unchanged.
 */
export function absoluteMockupUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = API_URL.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

export function useSupplierCatalog() {
  const query = useQuery<SupplierCatalogTreeDTO>({
    queryKey: KEY,
    queryFn: async () =>
      (await api.get<SupplierCatalogTreeDTO>("/catalog/supplier/tree")).data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  // Whenever the tree resolves, register every model in the runtime catalog
  // so non-React lookups (store, pricing) see them.
  useEffect(() => {
    if (!query.data) return;
    const models = query.data.categories.flatMap((cat) =>
      cat.models.map((m) => supplierToTextileModel(m, cat.category)),
    );
    registerTextileModels(models);
  }, [query.data]);

  return query;
}

/**
 * Subscribe to the runtime catalog so a component re-renders whenever a new
 * supplier model is registered. Use this in pickers / dropdowns that should
 * react live.
 */
export function useRuntimeTextileModels() {
  const list = useSyncExternalStore(
    subscribeRuntimeCatalog,
    getAllTextileModels,
    getAllTextileModels,
  );
  return useMemo(() => list, [list]);
}

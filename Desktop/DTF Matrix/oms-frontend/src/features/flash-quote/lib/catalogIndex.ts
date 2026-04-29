import Fuse from "fuse.js";
import type {
  CatalogFamily,
  CatalogProduct,
  CatalogSubfamily,
  CatalogTree,
  PricingMatrix,
  PricingTier,
} from "@/lib/catalog";

export interface FlatCatalogProduct {
  id: string;
  reference: string;
  name: string;
  designation: string;
  family: string;
  subfamily: string;
  defaultPrice: number;
  pricingMatrixId: string | null;
  tiers: PricingTier[];
}

/** Renvoie le tier correspondant à la quantité donnée (palier dégressif). */
export function getTierForQty(tiers: PricingTier[], qty: number): PricingTier | null {
  if (!tiers.length) return null;
  let best = tiers[0];
  for (const t of tiers) {
    if (t.minQty <= qty) best = t;
  }
  return best;
}

export function flattenCatalog(tree: CatalogTree | undefined): FlatCatalogProduct[] {
  if (!tree) return [];
  const matrices = new Map<string, PricingMatrix>();
  for (const m of tree.pricing_matrices) matrices.set(m.id, m);

  const out: FlatCatalogProduct[] = [];
  for (const fam of tree.families as CatalogFamily[]) {
    if (!fam.enabled) continue;
    for (const sf of fam.subfamilies as CatalogSubfamily[]) {
      if (!sf.enabled) continue;
      for (const p of sf.products as CatalogProduct[]) {
        if (!p.enabled) continue;
        const matrix = p.pricing_matrix_id ? matrices.get(p.pricing_matrix_id) : null;
        const tiers: PricingTier[] = matrix?.tiers ?? [];
        const defaultPrice = tiers[0]?.vierge ?? 0;
        out.push({
          id: p.id,
          reference: p.reference,
          name: p.name,
          designation: p.name,
          family: fam.label,
          subfamily: sf.label,
          defaultPrice,
          pricingMatrixId: p.pricing_matrix_id,
          tiers,
        });
      }
    }
  }
  return out;
}

export function buildFuseIndex(products: FlatCatalogProduct[]): Fuse<FlatCatalogProduct> {
  return new Fuse(products, {
    keys: [
      { name: "reference", weight: 1.0 },
      { name: "name", weight: 0.7 },
      { name: "subfamily", weight: 0.3 },
      { name: "family", weight: 0.2 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 1,
    includeScore: true,
  });
}

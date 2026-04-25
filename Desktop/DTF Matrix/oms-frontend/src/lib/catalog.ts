// Catalog API response types — shared between useCatalog hook and features

export interface ColorVariant {
  id: string;
  label: string;
  hex: string;
  swatchBorder?: boolean;
}

export interface SizeOption {
  id: string;
  label: string;
  order: number;
}

export interface PricingTier {
  minQty: number;
  vierge: number;
  coeur: number;
  dos: number;
}

export interface PricingMatrix {
  id: string;
  name: string;
  currency: string;
  tiers: PricingTier[];
}

export interface CatalogProduct {
  id: string;
  subfamily_id: string;
  reference: string;
  name: string;
  description: string | null;
  image_url: string | null;
  pricing_matrix_id: string | null;
  position: number;
  enabled: boolean;
  colors: ColorVariant[];
  sizes: SizeOption[];
}

export interface CatalogSubfamily {
  id: string;
  family_id: string;
  slug: string;
  label: string;
  target: string | null;
  position: number;
  enabled: boolean;
  products: CatalogProduct[];
}

export interface CatalogFamily {
  id: string;
  slug: string;
  label: string;
  icon: string;
  position: number;
  enabled: boolean;
  subfamilies: CatalogSubfamily[];
}

export interface CatalogTree {
  families: CatalogFamily[];
  pricing_matrices: PricingMatrix[];
}

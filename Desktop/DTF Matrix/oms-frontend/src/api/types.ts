// ───────── Pricing ─────────

export interface PricingTier {
  minQty: number;
  vierge: number;
  coeur: number;
  dos: number;
}

export interface PricingMatrixRead {
  id: string;
  name: string;
  currency: string;
  tiers: PricingTier[];
  created_at: string;
  updated_at: string;
}

// ───────── Color & Size ─────────

export interface ColorVariant {
  id: string;
  label: string;
  hex: string;
  swatchBorder?: boolean;
  commercialName?: string;
  manufacturerCode?: string;
  pantone?: string;
  rgb?: { r: number; g: number; b: number };
  mockupUrl?: string;
}

export interface SizeOption {
  id: string;
  label: string;
  order: number;
}

// ───────── Product ─────────

export interface ProductRead {
  id: string;
  subfamily_id: string;
  reference: string;
  name: string;
  description?: string;
  image_url?: string;
  pricing_matrix_id?: string;
  position: number;
  enabled: boolean;
  colors: ColorVariant[];
  sizes: SizeOption[];
  brand?: string;
  sku_supplier?: string;
  fabric_composition?: string;
  fabric_weight_gsm?: number;
  fit_type?: string;
  print_techniques: string[];
}

// ───────── Subfamily ─────────

export interface SubfamilyRead {
  id: string;
  family_id: string;
  slug: string;
  label: string;
  target?: string;
  position: number;
  enabled: boolean;
  products: ProductRead[];
}

// ───────── Family ─────────

export interface FamilyRead {
  id: string;
  slug: string;
  label: string;
  icon: string;
  position: number;
  enabled: boolean;
  subfamilies: SubfamilyRead[];
}

// ───────── Tree ─────────

export interface CatalogTree {
  families: FamilyRead[];
  pricing_matrices: PricingMatrixRead[];
}

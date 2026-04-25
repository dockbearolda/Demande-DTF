// ============================================================
// New Order — polymorphic form domain types
// ============================================================

export type ClassicSecteur =
  | "DTF"
  | "Pressage"
  | "UV"
  | "Trotec"
  | "Goodies"
  | "Autres";

export type Secteur = ClassicSecteur | "Textiles";

export const ALL_SECTEURS: Secteur[] = [
  "DTF",
  "Textiles",
  "Pressage",
  "UV",
  "Trotec",
  "Goodies",
  "Autres",
];

export type OperatorValue = "L" | "C" | "M";
export type Target = "HOMME" | "FEMME" | "ENFANT";

// ───────── Header (stable across secteur switches) ─────────

export interface OrderHeader {
  clientId: string | null;
  clientNom: string;
  personneContact: string;
  telephone: string;
  assignedTo: OperatorValue | "";
  dateLivraison: string;
  isUrgent: boolean;
  notes: string;
}

// ───────── Classic line ─────────

export interface ClassicLine {
  kind: "classic";
  secteur: ClassicSecteur;
  produit: string;
  customProduit?: string;
  quantity: number;
  prixUnitaire: number;
  notes?: string;
}

// ───────── Textile line ─────────

export interface TextileColor {
  id: string;
  label: string;
  hex: string;
  swatchBorder?: boolean;
}

export interface TextileSize {
  id: string;
  label: string;
  order: number;
}

export interface TextileModel {
  id: string;
  reference: string;
  name: string;
  target: Target;
  colors: TextileColor[];
  sizes: TextileSize[];
  pricingKey: string;
}

export interface TextileItem {
  id: string;
  size: string;
  color: string;
  qty: number;
  /** qty "au hasard" pour devis rapide sans tailles précises */
  isPlaceholder?: boolean;
}

export interface MockupSide {
  mockupDataUrl: string | null;
  logoDataUrl: string | null;
  positionXPct: number;
  positionYPct: number;
  logoWidthPct: number;
}

export interface TextileDesign {
  front: MockupSide | null;
  back: MockupSide | null;
  sleeves: MockupSide | null;
  skipped: boolean;
  studioBatId?: string;
}

export interface TextileLine {
  kind: "textile";
  target: Target;
  modelId: string;
  modelName: string;
  /** Record keyé par TextileItem.id — O(1) updates, stable React keys */
  items: Record<string, TextileItem>;
  design: TextileDesign;
  notes?: string;
}

// ───────── Union + draft ─────────

export type OrderLine = ClassicLine | TextileLine;

export interface OrderDraft {
  header: OrderHeader;
  line: OrderLine | null;
}

export const isTextileLine = (l: OrderLine): l is TextileLine =>
  l.kind === "textile";
export const isClassicLine = (l: OrderLine): l is ClassicLine =>
  l.kind === "classic";

// ───────── Pricing normalization ─────────

export interface NormalizedLine {
  pricingKey: string;
  totalQty: number;
  breakdown?: Array<{ label: string; qty: number }>;
}

export interface PricingTier {
  minQty: number;
  unitPrice: number;
}

export interface LineTotals {
  totalQty: number;
  unitPrice: number;
  subtotal: number;
  appliedTier: PricingTier | null;
  nextTier: PricingTier | null;
  unitsToNextTier: number | null;
}

// ───────── Validation ─────────

export type FieldErrorKey = keyof OrderHeader | "secteur" | "line";

export interface ValidationResult {
  ok: boolean;
  fieldErrors: Partial<Record<FieldErrorKey, string>>;
}

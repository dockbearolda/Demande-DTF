import type {
  ClassicSecteur,
  PricingTier,
  Secteur,
  TextileColor,
  TextileModel,
  TextileSize,
} from "./types";

// ───────── Catégories de produits ─────────

export type ProductCategoryId =
  | "textile"
  | "porte-cles-plexiglass"
  | "porte-cles-acrylique"
  | "tasses-gourdes"
  | "trophees-medailles"
  | "goodies";

export interface ProductCategoryConfig {
  id: ProductCategoryId;
  label: string;
  description: string;
  icon: string;
  /** Secteur auto-sélectionné (null = l'utilisateur doit choisir via secteurOptions) */
  autoSecteur: Secteur | null;
  /** Badge affiché quand plusieurs machines sont impliquées (ex: "UV + Trotec") */
  displaySecteur?: string;
  /** Sous-choix de secteur à présenter à l'utilisateur */
  secteurOptions?: ClassicSecteur[];
  /** Liste de produits propre à cette catégorie */
  produits?: string[];
}

export const ICON_TEXTILE = "M10,2 C10,2 8,6 8,10 C8,14 10,18 10,18 C10,18 12,14 12,10 C12,6 10,2 10,2 M8,10 L12,10 M6,10 C6,13 7,16 10,17 M14,10 C14,13 13,16 10,17";
export const ICON_KEYS = "M12,2 C13.1,2 14,2.9 14,4 C14,5.1 13.1,6 12,6 C11.8,6 11.6,6 11.4,5.9 L7,9.3 C7,9.5 7,9.7 7,10 C7,11.1 6.1,12 5,12 L4,12 L4,14 L5,14 C6.1,14 7,14.9 7,16 C7,17.1 6.1,18 5,18 L3,18 C2.4,18 2,17.6 2,17 L2,5 C2,3.9 2.9,3 4,3 L11.4,3.1 C11.6,3 11.8,3 12,3 Z";
export const ICON_CUP = "M8,2 L8,6 C8,7.1 8.9,8 10,8 C11.1,8 12,7.1 12,6 L12,2 L8,2 M5,8 L5,10 C5,12.2 6.8,14 9,14 L11,14 C13.2,14 15,12.2 15,10 L15,8 L5,8 M3,15 L17,15 L16,18 L4,18 Z";
export const ICON_TROPHY = "M8,2 L8,5 C5,6 3,8 3,11 C3,14.3 5.2,17 8,18 L8,20 L12,20 L12,18 C14.8,17 17,14.3 17,11 C17,8 15,6 12,5 L12,2 L8,2 M8,5 L12,5 M6,11 C6,13.2 7.8,15 10,15 C12.2,15 14,13.2 14,11 L6,11 Z";
export const ICON_BOX = "M3,6 L3,18 C3,19.1 3.9,20 5,20 L19,20 C20.1,20 21,19.1 21,18 L21,6 L3,6 M3,10 L21,10 M7,14 L7,18 M10,14 L10,18 M13,14 L13,18 M16,14 L16,18 M3,6 L9,3 L15,6 L21,6 L21,10 L15,7 L9,10 L3,10 Z";
export const ICON_GIFT = "M11,1 L9,4 L15,4 L13,1 Z M10,4 L4,4 C2.9,4 2,4.9 2,6 L2,8 L16,8 L16,6 C16,4.9 15.1,4 14,4 L10,4 M7,8 L7,20 C7,21.1 7.9,22 9,22 L13,22 C14.1,22 15,21.1 15,20 L15,8 L11,8 L11,16 L12,16 L12,8 L9,8 Z";

export const PRODUCT_CATEGORIES: ProductCategoryConfig[] = [
  {
    id: "textile",
    label: "Textile",
    description: "T-shirts, polos, sweats…",
    icon: "shirt",
    autoSecteur: "Textiles",
  },
  {
    id: "porte-cles-plexiglass",
    label: "Plexiglass",
    description: "Impression UV + découpe laser",
    icon: "keys",
    autoSecteur: "UV",
    displaySecteur: "UV + Trotec",
    produits: ["Porte-clés plexiglass", "Magnet plexiglass"],
  },
  {
    id: "porte-cles-acrylique",
    label: "Acrylique",
    description: "Gravure et découpe laser",
    icon: "keys",
    autoSecteur: "Trotec",
    produits: ["Porte-clés acrylique", "Magnet acrylique"],
  },
  {
    id: "tasses-gourdes",
    label: "Tasses",
    description: "Mugs, gourdes isothermes, thermos…",
    icon: "cup",
    autoSecteur: "Trotec",
    produits: ["Tasse", "Mug", "Gourde", "Thermos isotherme", "Gourde inox"],
  },
  {
    id: "trophees-medailles",
    label: "Trophées",
    description: "Récompenses, médailles, coupes…",
    icon: "trophy",
    autoSecteur: "Trotec",
    displaySecteur: "UV + Trotec",
    produits: ["Trophée", "Médaille", "Coupe", "Plaquette", "Podium"],
  },
  {
    id: "goodies",
    label: "Goodies",
    description: "Objets publicitaires",
    icon: "gift",
    autoSecteur: null,
    secteurOptions: ["Trotec", "UV"],
    produits: ["Stylo", "Carnet", "Badge", "Sticker", "Magnet", "Porte-clés"],
  },
];

export const OPERATEURS = [
  { value: "L" as const, initial: "L", name: "Loïc" },
  { value: "C" as const, initial: "C", name: "Charlie" },
  { value: "M" as const, initial: "M", name: "Mélina" },
];

// ───────── Produits par secteur classique ─────────

export const PRODUITS_PAR_SECTEUR: Record<ClassicSecteur, string[]> = {
  DTF: ["Planche A3", "Planche A4", "Mètre linéaire", "Film UV", "Transfert nominatif"],
  Pressage: ["T-Shirt", "Polo", "Sweat", "Tablier", "Serviette"],
  UV: ["Mug", "Gourde", "Coque", "Plaque alu", "Verre"],
  Trotec: ["Plexi", "Bois", "Médaille", "Trophée", "Signalétique"],
  Goodies: ["Stylo", "Carnet", "Porte-clés", "Badge", "Sticker", "Magnet"],
  Autres: ["Sur-mesure"],
};

export const QUANTITES_PRESET = [5, 10, 20, 50, 100, 200, 500];

// ───────── Tarification par pricingKey ─────────

export const PRICING: Record<string, PricingTier[]> = {
  DTF: [
    { minQty: 1, unitPrice: 8 },
    { minQty: 20, unitPrice: 6 },
    { minQty: 50, unitPrice: 4.5 },
    { minQty: 100, unitPrice: 3.5 },
    { minQty: 200, unitPrice: 2.8 },
  ],
  Pressage: [
    { minQty: 1, unitPrice: 6 },
    { minQty: 20, unitPrice: 4.5 },
    { minQty: 50, unitPrice: 3.5 },
    { minQty: 100, unitPrice: 2.8 },
  ],
  UV: [
    { minQty: 1, unitPrice: 12 },
    { minQty: 20, unitPrice: 9 },
    { minQty: 50, unitPrice: 7 },
    { minQty: 100, unitPrice: 5.5 },
  ],
  Trotec: [
    { minQty: 1, unitPrice: 18 },
    { minQty: 20, unitPrice: 14 },
    { minQty: 50, unitPrice: 11 },
  ],
  Goodies: [
    { minQty: 1, unitPrice: 4 },
    { minQty: 50, unitPrice: 2.5 },
    { minQty: 200, unitPrice: 1.6 },
    { minQty: 500, unitPrice: 1.1 },
  ],
  Autres: [{ minQty: 1, unitPrice: 10 }],

  // Textiles — pricing par modèle
  "Textiles/CGTU01": [
    { minQty: 1, unitPrice: 12 },
    { minQty: 20, unitPrice: 9.5 },
    { minQty: 50, unitPrice: 8 },
    { minQty: 100, unitPrice: 6.5 },
  ],
  "Textiles/K3025": [
    { minQty: 1, unitPrice: 14 },
    { minQty: 20, unitPrice: 11 },
    { minQty: 50, unitPrice: 9 },
    { minQty: 100, unitPrice: 7.5 },
  ],
  "Textiles/NS300": [
    { minQty: 1, unitPrice: 22 },
    { minQty: 20, unitPrice: 18 },
    { minQty: 50, unitPrice: 15 },
    { minQty: 100, unitPrice: 12.5 },
  ],
};

// ───────── Catalogue textile ─────────

const STD_SIZES: TextileSize[] = [
  { id: "XS", label: "XS", order: 0 },
  { id: "S", label: "S", order: 1 },
  { id: "M", label: "M", order: 2 },
  { id: "L", label: "L", order: 3 },
  { id: "XL", label: "XL", order: 4 },
  { id: "XXL", label: "XXL", order: 5 },
  { id: "3XL", label: "3XL", order: 6 },
];

const KID_SIZES: TextileSize[] = [
  { id: "4A", label: "4A", order: 0 },
  { id: "6A", label: "6A", order: 1 },
  { id: "8A", label: "8A", order: 2 },
  { id: "10A", label: "10A", order: 3 },
  { id: "12A", label: "12A", order: 4 },
  { id: "14A", label: "14A", order: 5 },
];

const STD_COLORS: TextileColor[] = [
  { id: "white", label: "Blanc", hex: "#FFFFFF", swatchBorder: true },
  { id: "black", label: "Noir", hex: "#0F172A" },
  { id: "navy", label: "Marine", hex: "#1E3A8A" },
  { id: "red", label: "Rouge", hex: "#DC2626" },
  { id: "royal", label: "Royal", hex: "#2563EB" },
  { id: "forest", label: "Forêt", hex: "#166534" },
  { id: "grey", label: "Gris chiné", hex: "#9CA3AF" },
  { id: "sand", label: "Sable", hex: "#D6CFC4", swatchBorder: true },
];

export const TEXTILE_MODELS: TextileModel[] = [
  {
    id: "CGTU01",
    reference: "CGTU01",
    name: "T-shirt ECO",
    target: "HOMME",
    colors: STD_COLORS,
    sizes: STD_SIZES,
    pricingKey: "Textiles/CGTU01",
  },
  {
    id: "CGTU01-F",
    reference: "CGTU01-F",
    name: "T-shirt ECO",
    target: "FEMME",
    colors: STD_COLORS,
    sizes: STD_SIZES.slice(0, 5),
    pricingKey: "Textiles/CGTU01",
  },
  {
    id: "CGTU01-E",
    reference: "CGTU01-E",
    name: "T-shirt ECO",
    target: "ENFANT",
    colors: STD_COLORS,
    sizes: KID_SIZES,
    pricingKey: "Textiles/CGTU01",
  },
  {
    id: "K3025",
    reference: "K3025",
    name: "T-shirt Classic",
    target: "HOMME",
    colors: STD_COLORS,
    sizes: STD_SIZES,
    pricingKey: "Textiles/K3025",
  },
  {
    id: "K3025-F",
    reference: "K3025-F",
    name: "T-shirt Classic",
    target: "FEMME",
    colors: STD_COLORS,
    sizes: STD_SIZES.slice(0, 5),
    pricingKey: "Textiles/K3025",
  },
  {
    id: "NS300",
    reference: "NS300",
    name: "Premium",
    target: "HOMME",
    colors: STD_COLORS,
    sizes: STD_SIZES,
    pricingKey: "Textiles/NS300",
  },
  {
    id: "NS300-F",
    reference: "NS300-F",
    name: "Premium",
    target: "FEMME",
    colors: STD_COLORS,
    sizes: STD_SIZES.slice(0, 5),
    pricingKey: "Textiles/NS300",
  },
];

export const TARGETS: { id: "HOMME" | "FEMME" | "ENFANT"; label: string }[] = [
  { id: "HOMME", label: "Homme" },
  { id: "FEMME", label: "Femme" },
  { id: "ENFANT", label: "Enfant" },
];

export function isClassicSecteur(s: Secteur): s is ClassicSecteur {
  return s !== "Textiles";
}

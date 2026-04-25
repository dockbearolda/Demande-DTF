import type {
  ClassicSecteur,
  PricingTier,
  Secteur,
  TextileColor,
  TextileModel,
  TextileSize,
} from "./types";

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

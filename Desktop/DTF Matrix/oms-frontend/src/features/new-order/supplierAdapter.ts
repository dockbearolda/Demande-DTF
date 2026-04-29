/**
 * Converts the supplier-catalog DTOs (returned by `/catalog/supplier/tree`)
 * into the legacy `TextileModel` shape used throughout the order form, BAT
 * studio, pricing, and PDF generation.
 *
 * Two pieces don't come from the supplier API:
 *   - sizes: the manifest has no size data, so we apply the standard
 *     adult/kid grids from `constants.ts`. To customize per-model sizing,
 *     extend `SIZE_OVERRIDES` below.
 *   - pricingKey: the supplier reference doesn't carry prices yet (Q4 with
 *     the user → "les prix sont bidon"), so we map every model to a single
 *     placeholder pricing tier. When real prices land, replace this map with
 *     a live pricing-matrix lookup.
 */
import type {
  SupplierColorDTO,
  SupplierMockupDTO,
  SupplierModelDTO,
} from "@/hooks/useSupplierCatalog";
import { absoluteMockupUrl } from "@/hooks/useSupplierCatalog";
import { COLOR_FALLBACK_HEX, resolveColorHex } from "@/lib/colors.config";
import type {
  SupplierMockupRef,
  SupplierMockupView,
  Target,
  TextileColor,
  TextileModel,
  TextileSize,
} from "./types";

const STD_ADULT_SIZES: TextileSize[] = [
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

const BABY_SIZES: TextileSize[] = [
  { id: "0-3M", label: "0-3M", order: 0 },
  { id: "3-6M", label: "3-6M", order: 1 },
  { id: "6-12M", label: "6-12M", order: 2 },
  { id: "12-18M", label: "12-18M", order: 3 },
  { id: "18-24M", label: "18-24M", order: 4 },
];

function categoryToTarget(category: string): Target {
  switch (category) {
    case "HOMME":
      return "HOMME";
    case "FEMME":
      return "FEMME";
    case "ENFANT":
    case "BEBE":
      return "ENFANT";
    default:
      return "HOMME";
  }
}

function sizesForCategory(category: string): TextileSize[] {
  switch (category) {
    case "ENFANT":
      return KID_SIZES;
    case "BEBE":
      return BABY_SIZES;
    case "FEMME":
      return STD_ADULT_SIZES.slice(0, 5); // XS-XL
    default:
      return STD_ADULT_SIZES;
  }
}

/** Pick a representative front mockup URL for a color (fallback: any view). */
function pickFrontMockup(color: SupplierColorDTO): string | undefined {
  const front = color.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
  if (front) return absoluteMockupUrl(front.url);
  const any = color.mockups.find((m) => !m.is_lifestyle);
  return any ? absoluteMockupUrl(any.url) : undefined;
}

/**
 * Map les valeurs `view` du backend (`front`, `back`, `sleeve`, `front_alt`,
 * `front_sleeve`, `*_lifestyle`…) vers les `ViewId` du studio BAT.
 *
 * Le manifest fournit en pratique une vue `sleeve` générique non latéralisée :
 * on l'utilise pour les deux manches (`sleeve_left` et `sleeve_right`) en
 * attendant des assets dédiés. Les variantes `_lifestyle` et `_alt` sont
 * filtrées (pas pertinentes pour la composition BAT).
 */
function mapMockupViews(view: string): SupplierMockupView[] {
  if (view.includes("lifestyle") || view.includes("alt")) return [];
  switch (view) {
    case "front":
      return ["front"];
    case "back":
      return ["back"];
    case "sleeve":
      return ["sleeve_left", "sleeve_right"];
    case "front_sleeve":
      // vue mixte avant + manche — on la rattache à `front` par défaut.
      return ["front"];
    default:
      return [];
  }
}

function buildSupplierMockupRefs(
  mockups: SupplierMockupDTO[],
): SupplierMockupRef[] {
  const byView = new Map<SupplierMockupView, SupplierMockupRef>();
  for (const m of mockups) {
    if (m.is_lifestyle) continue;
    const targets = mapMockupViews(m.view);
    if (targets.length === 0) continue;
    const ref: Omit<SupplierMockupRef, "view"> = {
      url: absoluteMockupUrl(m.url),
      naturalWidth: m.width ?? undefined,
      naturalHeight: m.height ?? undefined,
    };
    for (const v of targets) {
      // Le premier mockup matchant gagne (les variantes `_alt` sont déjà
      // filtrées plus haut, donc l'ordre du DTO suffit).
      if (!byView.has(v)) byView.set(v, { view: v, ...ref });
    }
  }
  return [...byView.values()];
}

function adaptColor(c: SupplierColorDTO): TextileColor {
  // Le fournisseur ne fournit pas toujours `hex` (ex: ancien manifest).
  // On résout via la table centralisée (slug + label) avant de retomber sur
  // le placeholder neutre — évite les carrés gris uniformes pour les couleurs
  // dont le fabricant connaît juste le nom commercial.
  const resolved = c.hex ?? resolveColorHex(c.slug, c.label) ?? COLOR_FALLBACK_HEX;
  const isNearWhite = resolved.toLowerCase() === "#ffffff";
  return {
    id: c.slug,
    label: c.label,
    hex: resolved,
    swatchBorder: c.hex === null || isNearWhite,
    mockupUrl: pickFrontMockup(c),
    supplierMockups: buildSupplierMockupRefs(c.mockups),
  };
}

/**
 * The TextileModel id is set to `ref_internal` (e.g. "H-013") so it's stable
 * across reseeds — `_manifest.csv` regenerates the same internal codes every
 * time. UUIDs would shift on reseed, breaking persisted drafts.
 */
export function supplierToTextileModel(
  s: SupplierModelDTO,
  categoryFromGroup?: string,
): TextileModel {
  const category = categoryFromGroup ?? s.category;
  const target = categoryToTarget(category);
  return {
    id: s.ref_internal,
    reference: s.ref_supplier,
    name: s.name ?? `${s.ref_label}`,
    target,
    colors: s.colors.filter((c) => c.enabled).map(adaptColor),
    sizes: sizesForCategory(category),
    pricingKey: `Textiles/Supplier`,
    brand: s.brand ?? undefined,
    skuSupplier: s.ref_supplier,
    fabricComposition: s.fabric_composition ?? undefined,
    fabricWeightGsm: s.fabric_weight_gsm ?? undefined,
    fitType: (s.fit_type as TextileModel["fitType"]) ?? undefined,
    printTechniques: ["DTF", "Sérigraphie", "Flex"],
  };
}

import { PLACEMENT_SURCHARGE_TIERS, PRICING } from "./constants";
import { getTextileModel } from "./runtimeCatalog";
import {
  isClassicLine,
  isTextileLine,
  type LineTotals,
  type NormalizedLine,
  type OrderLine,
  type PricingTier,
} from "./types";

/**
 * Supplément forfaitaire par placement de logo (corps + manche). Tous les
 * placements sont cumulables. Sert de fallback quand le pricingKey n'a pas de
 * grille dégressive dans `PLACEMENT_SURCHARGE_TIERS`.
 */
const LOGO_PLACEMENT_SURCHARGES: Record<string, number> = {
  front: 5,
  back: 10,
  "sleeve-left": 5,
  "sleeve-right": 5,
};

/**
 * Frais fixe de changement de couleur d'encre / fil, appliqué par couleur
 * d'article supplémentaire ET par placement marqué — chaque combinaison
 * (couleur additionnelle × placement) implique un arrêt machine, un nettoyage
 * de cadre et un nouveau calage. La 1ère couleur est considérée incluse dans
 * le prix de base (le calage initial est déjà payé via le palier quantité).
 *
 * Centralisé ici plutôt que dans `constants.ts` pour rester colocalisé avec
 * la logique de tarification ; à externaliser le jour où la grille devient
 * paramétrable par `pricingKey` (cf. `PLACEMENT_SURCHARGE_TIERS`).
 */
export const COLOR_CHANGE_FEE_PER_PLACEMENT = 25;

/** Normalise une OrderLine vers la forme consommée par PriceBar. */
export function toNormalized(line: OrderLine | null): NormalizedLine | null {
  if (!line) return null;

  if (isClassicLine(line)) {
    return {
      pricingKey: line.secteur,
      totalQty: line.quantity,
    };
  }

  if (isTextileLine(line)) {
    const model = getTextileModel(line.modelId);
    const pricingKey = model?.pricingKey ?? "";
    const items = Object.values(line.items);
    const totalQty = items.reduce((sum, it) => sum + (it.qty || 0), 0);

    // Breakdown par taille pour un tooltip éventuel
    const bySize = new Map<string, number>();
    for (const it of items) {
      bySize.set(it.size, (bySize.get(it.size) ?? 0) + it.qty);
    }
    const breakdown = [...bySize.entries()]
      .filter(([, qty]) => qty > 0)
      .map(([label, qty]) => ({ label, qty }));

    return { pricingKey, totalQty, breakdown };
  }

  return null;
}

/** Compte les couleurs distinctes ayant au moins une pièce. Une seule passe
 *  sur `items`, sans allocation d'objets intermédiaires hors du Set. */
export function countDistinctColors(line: OrderLine | null): number {
  if (!line || !isTextileLine(line)) return 0;
  const colors = new Set<string>();
  for (const it of Object.values(line.items)) {
    if (it.isPlaceholder) continue;
    if ((it.qty || 0) <= 0) continue;
    colors.add(it.color);
  }
  return colors.size;
}

/** Compte les placements logo activés (corps + manches). Sert au calcul du
 *  frais de changement de couleur, qui s'applique par placement. */
function countActivePlacements(line: OrderLine): number {
  if (!isTextileLine(line)) return 0;
  return (
    (line.bodyPlacements?.length ?? 0) +
    (line.sleeveLogoPlacements?.length ?? 0)
  );
}

/**
 * Calcule le frais de calage lié aux changements de couleur d'encre / fil.
 *
 * Règle métier :
 *   - `hasIdenticalLogoSetup === true` (défaut) → 0 €. Le même calage couvre
 *     toute la production, peu importe le nombre de couleurs d'articles.
 *   - `hasIdenticalLogoSetup === false` → chaque couleur d'article au-delà de
 *     la 1ère implique un arrêt machine + nettoyage cadre + nouveau calage,
 *     pour CHAQUE placement marqué.
 *     Frais = (couleurs distinctes − 1) × placements actifs × tarif unitaire.
 *
 * Sans effet quand 0 ou 1 couleur active (rien à changer entre lots) ou quand
 * aucun placement n'est sélectionné (pas de marquage à recaler).
 */
export function computeColorChangeFee(
  line: OrderLine | null,
  distinctColorCount: number,
): number {
  if (!line || !isTextileLine(line)) return 0;
  if (line.hasIdenticalLogoSetup !== false) return 0;
  if (distinctColorCount < 2) return 0;
  const placements = countActivePlacements(line);
  if (placements === 0) return 0;
  return (distinctColorCount - 1) * placements * COLOR_CHANGE_FEE_PER_PLACEMENT;
}

/** Retourne le tier applicable pour une quantité donnée. */
function findTier(tiers: PricingTier[], qty: number): PricingTier | null {
  if (!tiers.length || qty <= 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let applied: PricingTier = sorted[0];
  for (const t of sorted) {
    if (qty >= t.minQty) applied = t;
    else break;
  }
  return applied;
}

function findNextTier(
  tiers: PricingTier[],
  qty: number,
  current: PricingTier | null,
): PricingTier | null {
  if (!current) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  return sorted.find((t) => t.minQty > qty) ?? null;
}

/**
 * Calcule la somme des suppléments pour tous les placements sélectionnés
 * (corps + manches). Cumulatif. Si `pricingKey` + `qty` sont fournis et que le
 * modèle expose une grille dégressive dans `PLACEMENT_SURCHARGE_TIERS`, le
 * tarif appliqué dépend de la quantité ; sinon on retombe sur les forfaits
 * définis dans `LOGO_PLACEMENT_SURCHARGES`.
 */
export function getLogoSurcharge(
  bodyPlacements: readonly string[] | null | undefined,
  sleeves?: readonly string[] | null,
  pricingKey?: string,
  qty?: number,
): number {
  const all = [...(bodyPlacements ?? []), ...(sleeves ?? [])];
  const tierMap = pricingKey ? PLACEMENT_SURCHARGE_TIERS[pricingKey] : undefined;
  return all.reduce((sum, p) => {
    const tiers = tierMap?.[p];
    if (tiers && qty && qty > 0) {
      const tier = findTier(tiers, qty);
      if (tier) return sum + tier.unitPrice;
    }
    return sum + (LOGO_PLACEMENT_SURCHARGES[p] ?? 0);
  }, 0);
}

/** Calcule les totaux — pure fn, memoizable côté React. */
export function computeTotals(line: OrderLine | null): LineTotals {
  const normalized = toNormalized(line);
  const distinctColorCount = countDistinctColors(line);
  const empty: LineTotals = {
    totalQty: 0,
    unitPrice: 0,
    subtotal: 0,
    colorChangeFee: 0,
    distinctColorCount,
    appliedTier: null,
    nextTier: null,
    unitsToNextTier: null,
  };
  if (!normalized || normalized.totalQty <= 0) return empty;

  // Sourcing spécial — la grille tarifaire du secteur "Autres" ne doit pas
  // s'appliquer (le prix sera renseigné par un manager après chiffrage
  // fournisseur). On garde la quantité visible mais on neutralise le prix.
  if (line && isClassicLine(line) && line.isSourcingRequired) {
    return { ...empty, totalQty: normalized.totalQty };
  }

  const tiers = PRICING[normalized.pricingKey];
  if (!tiers) return { ...empty, totalQty: normalized.totalQty };

  const applied = findTier(tiers, normalized.totalQty);
  const next = findNextTier(tiers, normalized.totalQty, applied);
  let unitPrice = applied?.unitPrice ?? 0;
  let colorChangeFee = 0;

  // Add logo surcharge for textiles
  if (line && isTextileLine(line)) {
    unitPrice += getLogoSurcharge(
      line.bodyPlacements,
      line.sleeveLogoPlacements,
      normalized.pricingKey,
      normalized.totalQty,
    );
    // Override manuel saisi sur l'étape « Demande » — prend le pas sur le prix
    // calculé (paliers + suppléments placements).
    if (
      typeof line.prixUnitaireOverride === "number" &&
      line.prixUnitaireOverride > 0
    ) {
      unitPrice = line.prixUnitaireOverride;
    } else {
      unitPrice = roundUp05(unitPrice);
    }
    // Frais de changement de couleur — appliqué après l'override car c'est un
    // frais de calage forfaitaire, indépendant du prix unitaire négocié.
    colorChangeFee = computeColorChangeFee(line, distinctColorCount);
  } else {
    unitPrice = roundUp05(unitPrice);
  }

  const articlesSubtotal = unitPrice * normalized.totalQty;

  return {
    totalQty: normalized.totalQty,
    unitPrice,
    subtotal: articlesSubtotal + colorChangeFee,
    colorChangeFee,
    distinctColorCount,
    appliedTier: applied,
    nextTier: next,
    unitsToNextTier: next ? next.minQty - normalized.totalQty : null,
  };
}

// Arrondi au 0,5 supérieur : 1,03 → 1,5 ; 1,78 → 2,0
function roundUp05(x: number): number {
  return Math.ceil(x * 2) / 2;
}

export function formatEUR(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
}

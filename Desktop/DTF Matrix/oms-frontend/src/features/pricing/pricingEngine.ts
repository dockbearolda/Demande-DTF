/**
 * Moteur de tarification Textile 2026 — port TypeScript.
 *
 * Miroir exact de `oms-api/app/services/pricing_engine.py`. Les deux
 * doivent produire le même résultat au centime près (vérifié par les
 * tests pytest et Vitest qui partagent les mêmes critères §6).
 *
 * Règles métier (cf. prompt §3, mises à jour étape 4-bis) :
 *  - Palier appliqué = palier inférieur ou égal à `quantity`. Pas
 *    d'interpolation. Au-delà du dernier palier, on garde le dernier.
 *  - PrixVierge_unit = PA × coef(palier).
 *  - PrixLogos_unit  = Σ prix d'emplacement(palier) pour chaque
 *    emplacement coché.
 *  - Prix vente HT_unit = Vierge + Logos.
 *  - Sous-total HT (marchandise) = qty × prix_vente_ht_unit.
 *  - Transport : 1,56 € TTC **par unité** (× qty), case à cocher pour
 *    activer/désactiver. Le transport n'entre PAS dans l'assiette TGCA.
 *  - TGCA (4 % par défaut) appliquée sur le sous-total HT marchandise
 *    UNIQUEMENT.
 *  - Remise commerciale : montant TTC fixe soustrait au total final,
 *    clampé à [0, total_avant_remise].
 *  - Tous les montants finaux arrondis à 2 décimales (ROUND_HALF_UP).
 */

// ─── Types & constantes ──────────────────────────────────────────────

export type LogoPlacement =
  | "Coeur"
  | "Poitrine"
  | "AvantPlein"
  | "ArrierePlein"
  | "MancheG"
  | "MancheD";

export const ALL_PLACEMENTS: readonly LogoPlacement[] = [
  "Coeur",
  "Poitrine",
  "AvantPlein",
  "ArrierePlein",
  "MancheG",
  "MancheD",
];

const PLACEMENT_TO_TIER_KEY: Record<LogoPlacement, keyof PricingTier> = {
  Coeur: "coeur",
  Poitrine: "poitrine",
  AvantPlein: "avantPlein",
  ArrierePlein: "arrierePlein",
  MancheG: "mancheG",
  MancheD: "mancheD",
};

/** Palier tarifaire — format Textile 2026.
 *
 * Anciens champs (`vierge`, `dos`) acceptés en lecture pour rétrocompat
 * avec les matrices créées avant la migration 0021.
 */
export interface PricingTier {
  minQty: number;
  coef?: number | null;
  coeur?: number | null;
  poitrine?: number | null;
  avantPlein?: number | null;
  arrierePlein?: number | null;
  mancheG?: number | null;
  mancheD?: number | null;
  // legacy
  vierge?: number | null;
  dos?: number | null;
}

export interface PricingInput {
  /** Prix d'achat HT du modèle. `null` si non renseigné → warning. */
  purchasePriceHt: number | null;
  quantity: number;
  placements: readonly LogoPlacement[];
  tiers: readonly PricingTier[];
  /** Tarif unitaire transport TTC (par t-shirt). Défaut 1,56 €. */
  transportTtcUnit?: number;
  transportActive?: boolean;
  tgcaActive?: boolean;
  /** Taux TGCA. Défaut 4 %. */
  tgcaRate?: number;
  /** Remise commerciale TTC (montant fixe en €). Clampée à [0, total]. */
  discount?: number;
}

export interface LogoLine {
  placement: LogoPlacement;
  unitPrice: number;
}

export interface PricingOutput {
  quantity: number;
  palierApplique: number | null;
  coef: number | null;
  prixViergeUnit: number | null;
  logos: LogoLine[];
  prixLogosUnit: number;
  prixVenteHtUnit: number | null;
  /** Sous-total HT marchandise = qty × prix_vente_ht_unit. */
  sousTotalHt: number;
  /** Ligne transport totale (qty × tarif unitaire), 0 si désactivé. */
  transportTtc: number;
  /** TGCA, calculée sur la marchandise seule. */
  montantTgca: number;
  /** Total avant remise = marchandise + tgca + transport. */
  totalAvantRemise: number;
  /** Montant de remise effectivement appliqué (après clamp). */
  discount: number;
  /** Total TTC final = total_avant_remise − remise. */
  totalTtc: number;
  warnings: string[];
}

// ─── Arrondi ROUND_HALF_UP (positif uniquement, ce qui est notre cas) ─
//
// Astuce : on ajoute 1e-9 avant l'arrondi à 100 pour absorber les
// micro-erreurs IEEE 754 (ex. 4.05 × 1.73 = 7.006500000000001 en JS).
// 1e-9 est largement inférieur à la précision recherchée (1e-2).
function q2(x: number): number {
  return Math.round(x * 100 + 1e-9) / 100;
}

// Arrondi au 0,5 supérieur : 1,03 → 1,5 ; 1,78 → 2,0
function roundUp05(x: number): number {
  return Math.ceil(x * 2) / 2;
}

// ─── Lookup de palier ────────────────────────────────────────────────

export function findPalier(
  qty: number,
  tiers: readonly PricingTier[],
): PricingTier | null {
  if (qty < 1) return null;
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let chosen: PricingTier | null = null;
  for (const t of sorted) {
    if (t.minQty <= qty) {
      chosen = t;
    } else {
      break;
    }
  }
  return chosen;
}

// ─── Calcul ──────────────────────────────────────────────────────────

export function computeQuote(input: PricingInput): PricingOutput {
  const transportTtcUnit = input.transportTtcUnit ?? 1.56;
  const transportActive = input.transportActive ?? true;
  const tgcaActive = input.tgcaActive ?? false;
  const tgcaRate = input.tgcaRate ?? 0.04;
  const discountInput = input.discount ?? 0;

  const out: PricingOutput = {
    quantity: Math.max(input.quantity, 0),
    palierApplique: null,
    coef: null,
    prixViergeUnit: null,
    logos: [],
    prixLogosUnit: 0,
    prixVenteHtUnit: null,
    sousTotalHt: 0,
    transportTtc: 0,
    montantTgca: 0,
    totalAvantRemise: 0,
    discount: 0,
    totalTtc: 0,
    warnings: [],
  };

  if (input.quantity < 1) {
    out.warnings.push("Quantité < 1 — devis vide.");
    return out;
  }

  const palier = findPalier(input.quantity, input.tiers);
  if (palier === null) {
    out.warnings.push("Aucun palier applicable pour cette quantité.");
    return out;
  }

  out.palierApplique = palier.minQty;
  if (palier.coef !== null && palier.coef !== undefined) {
    out.coef = palier.coef;
  }

  // Prix vierge (PA × coef)
  if (input.purchasePriceHt === null || input.purchasePriceHt === undefined) {
    out.warnings.push("Prix d'achat du modèle non renseigné.");
    out.prixViergeUnit = null;
  } else if (out.coef === null) {
    out.warnings.push("Coefficient absent du palier.");
    out.prixViergeUnit = null;
  } else {
    out.prixViergeUnit = q2(input.purchasePriceHt * out.coef);
  }

  // Prix logos (somme des emplacements cochés, arrondis individuellement)
  let logosTotal = 0;
  for (const p of input.placements) {
    const key = PLACEMENT_TO_TIER_KEY[p as LogoPlacement];
    if (!key) {
      out.warnings.push(`Emplacement inconnu : ${p}`);
      continue;
    }
    const raw = palier[key];
    if (raw === null || raw === undefined) {
      out.warnings.push(`Prix manquant dans le palier pour ${p}.`);
      continue;
    }
    const unit = q2(raw as number);
    out.logos.push({ placement: p as LogoPlacement, unitPrice: unit });
    logosTotal += unit;
  }
  out.prixLogosUnit = q2(logosTotal);

  // Prix vente HT unitaire — arrondi au 0,5 supérieur
  if (out.prixViergeUnit === null) {
    out.prixVenteHtUnit = null;
  } else {
    out.prixVenteHtUnit = roundUp05(q2(out.prixViergeUnit + out.prixLogosUnit));
  }

  // Sous-total HT (marchandise) = qty × prix_vente_ht_unit
  if (out.prixVenteHtUnit !== null) {
    out.sousTotalHt = q2(out.prixVenteHtUnit * input.quantity);
  } else {
    out.sousTotalHt = 0;
  }

  // Transport ligne = qty × tarif unitaire TTC (si actif)
  out.transportTtc = transportActive
    ? q2(transportTtcUnit * input.quantity)
    : 0;

  // TGCA — sur la marchandise UNIQUEMENT (pas sur le transport)
  if (tgcaActive && tgcaRate > 0) {
    out.montantTgca = q2(out.sousTotalHt * tgcaRate);
  } else {
    out.montantTgca = 0;
  }

  // Total avant remise
  out.totalAvantRemise = q2(
    out.sousTotalHt + out.montantTgca + out.transportTtc,
  );

  // Remise commerciale (clampée à [0, total_avant_remise])
  let applied = discountInput;
  if (applied < 0) {
    out.warnings.push("Remise négative ignorée.");
    applied = 0;
  } else if (applied > out.totalAvantRemise) {
    out.warnings.push("Remise plafonnée au total avant remise.");
    applied = out.totalAvantRemise;
  }
  out.discount = q2(applied);

  out.totalTtc = q2(out.totalAvantRemise - out.discount);

  return out;
}

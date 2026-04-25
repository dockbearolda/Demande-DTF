// ============================================================
// Delivery rules — délais de production estimés par catégorie
// ============================================================
//
// Toutes les fenêtres sont en jours ouvrés (lun→ven), à partir de
// la validation du BAT par le client (J0). Les seuils de quantité
// ajoutent des jours en sus du délai de base.

import type { ProductCategoryId } from "../constants";

export interface QtyThreshold {
  /** Quantité à partir de laquelle s'applique le délai supplémentaire (inclus). */
  minQty: number;
  /** Jours ouvrés ajoutés à la fenêtre min ET max. */
  addDays: number;
}

export interface DeliveryRule {
  /** Délai standard [min, max] en jours ouvrés. */
  baseDays: [number, number];
  /** Délai express [min, max] quand "Urgent" est coché. */
  expressDays: [number, number];
  /**
   * Surcoût appliqué en mode urgent (multiplicateur sur PU). 0.20 = +20%.
   * Affichage seulement — la majoration tarifaire est gérée côté pricing.
   */
  expressSurcharge: number;
  /** Paliers de quantité qui rallongent la production. Ordonnés croissants. */
  qtyThresholds?: QtyThreshold[];
}

export const DELIVERY_RULES: Record<ProductCategoryId, DeliveryRule> = {
  textile: {
    baseDays: [8, 12],
    expressDays: [4, 5],
    expressSurcharge: 0.2,
    qtyThresholds: [
      { minQty: 100, addDays: 2 },
      { minQty: 250, addDays: 4 },
    ],
  },
  "porte-cles-plexiglass": {
    baseDays: [5, 8],
    expressDays: [3, 4],
    expressSurcharge: 0.25,
    qtyThresholds: [{ minQty: 200, addDays: 2 }],
  },
  "porte-cles-acrylique": {
    baseDays: [5, 8],
    expressDays: [3, 4],
    expressSurcharge: 0.25,
    qtyThresholds: [{ minQty: 200, addDays: 2 }],
  },
  "tasses-gourdes": {
    baseDays: [6, 9],
    expressDays: [3, 5],
    expressSurcharge: 0.2,
    qtyThresholds: [{ minQty: 100, addDays: 2 }],
  },
  "trophees-medailles": {
    baseDays: [10, 14],
    expressDays: [5, 7],
    expressSurcharge: 0.3,
    qtyThresholds: [{ minQty: 50, addDays: 3 }],
  },
  goodies: {
    baseDays: [4, 7],
    expressDays: [2, 3],
    expressSurcharge: 0.2,
    qtyThresholds: [
      { minQty: 200, addDays: 2 },
      { minQty: 500, addDays: 4 },
    ],
  },
};

/** Délai par défaut quand la catégorie n'est pas encore connue. */
export const DEFAULT_DELIVERY: DeliveryRule = {
  baseDays: [7, 10],
  expressDays: [3, 5],
  expressSurcharge: 0.2,
};

export interface DeliveryEstimate {
  minDays: number;
  maxDays: number;
  isExpress: boolean;
  /** Multiplicateur appliqué en express (ex. 0.2 = +20%). */
  surchargeRate: number;
  /** Date la plus tôt atteignable (ISO yyyy-mm-dd). */
  earliestIso: string;
  /** Borne haute estimée (ISO yyyy-mm-dd). */
  latestIso: string;
}

/**
 * Calcule l'estimation de livraison.
 * `from` = J0 = aujourd'hui (validation du BAT client supposée immédiate
 * pour la projection — on prévient l'opérateur, pas le client).
 */
export function computeDeliveryEstimate(
  categoryId: ProductCategoryId | null,
  totalQty: number,
  isUrgent: boolean,
  from: Date = new Date(),
): DeliveryEstimate {
  const rule = (categoryId && DELIVERY_RULES[categoryId]) || DEFAULT_DELIVERY;
  const window = isUrgent ? rule.expressDays : rule.baseDays;
  let [min, max] = window;

  // Paliers de quantité — appliqués hors mode urgent (l'urgence est plafonnée
  // côté production : on ne s'engage pas sur des très grandes séries en express).
  if (!isUrgent && rule.qtyThresholds && totalQty > 0) {
    let extra = 0;
    for (const th of rule.qtyThresholds) {
      if (totalQty >= th.minQty) extra = th.addDays;
    }
    min += extra;
    max += extra;
  }

  return {
    minDays: min,
    maxDays: max,
    isExpress: isUrgent,
    surchargeRate: isUrgent ? rule.expressSurcharge : 0,
    earliestIso: addBusinessDaysIso(from, min),
    latestIso: addBusinessDaysIso(from, max),
  };
}

/** Ajoute `days` jours ouvrés (lun→ven) à `from` et renvoie ISO yyyy-mm-dd. */
export function addBusinessDaysIso(from: Date, days: number): string {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Compare la date demandée à la fourchette estimée.
 *  - "ok" : date >= earliest
 *  - "tight" : date entre earliest-2 et earliest (faisable mais serré)
 *  - "missed" : date < earliest-2
 *  - null : pas de date renseignée
 */
export function checkRequestedDate(
  requestedIso: string,
  estimate: DeliveryEstimate,
): "ok" | "tight" | "missed" | null {
  if (!requestedIso) return null;
  const requested = new Date(requestedIso);
  const earliest = new Date(estimate.earliestIso);
  const diffDays = Math.round(
    (requested.getTime() - earliest.getTime()) / 86_400_000,
  );
  if (diffDays >= 0) return "ok";
  if (diffDays >= -2) return "tight";
  return "missed";
}

/** Format court : "8–12 j ouvrés" / "4–5 j (express)" */
export function formatDelayRange(estimate: DeliveryEstimate): string {
  const range =
    estimate.minDays === estimate.maxDays
      ? `${estimate.minDays}`
      : `${estimate.minDays}–${estimate.maxDays}`;
  return `${range} j ouvrés`;
}

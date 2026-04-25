import { PRICING, TEXTILE_MODELS } from "./constants";
import {
  isClassicLine,
  isTextileLine,
  type LineTotals,
  type NormalizedLine,
  type OrderLine,
  type PricingTier,
} from "./types";

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
    const model = TEXTILE_MODELS.find((m) => m.id === line.modelId);
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

/** Calcule les totaux — pure fn, memoizable côté React. */
export function computeTotals(line: OrderLine | null): LineTotals {
  const normalized = toNormalized(line);
  const empty: LineTotals = {
    totalQty: 0,
    unitPrice: 0,
    subtotal: 0,
    appliedTier: null,
    nextTier: null,
    unitsToNextTier: null,
  };
  if (!normalized || normalized.totalQty <= 0) return empty;

  const tiers = PRICING[normalized.pricingKey];
  if (!tiers) return { ...empty, totalQty: normalized.totalQty };

  const applied = findTier(tiers, normalized.totalQty);
  const next = findNextTier(tiers, normalized.totalQty, applied);
  const unitPrice = applied?.unitPrice ?? 0;

  return {
    totalQty: normalized.totalQty,
    unitPrice,
    subtotal: unitPrice * normalized.totalQty,
    appliedTier: applied,
    nextTier: next,
    unitsToNextTier: next ? next.minQty - normalized.totalQty : null,
  };
}

export function formatEUR(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
}

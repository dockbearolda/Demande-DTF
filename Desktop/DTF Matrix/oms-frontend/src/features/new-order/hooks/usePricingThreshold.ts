import { useMemo } from "react";
import type { PricingTier } from "../types";

export interface ThresholdResult {
  nextTier: PricingTier | null;
  qtyNeeded: number | null;
  savingsAmount: number | null;
}

export function usePricingThreshold(qty: number, tiers: PricingTier[]): ThresholdResult {
  return useMemo(() => {
    if (!tiers.length || qty <= 0) return { nextTier: null, qtyNeeded: null, savingsAmount: null };

    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

    let currentTier: PricingTier | null = null;
    for (const t of sorted) {
      if (qty >= t.minQty) currentTier = t;
      else break;
    }

    const nextTier = sorted.find((t) => t.minQty > qty) ?? null;

    if (!nextTier || !currentTier) return { nextTier: null, qtyNeeded: null, savingsAmount: null };

    return {
      nextTier,
      qtyNeeded: nextTier.minQty - qty,
      savingsAmount: (currentTier.unitPrice - nextTier.unitPrice) * qty,
    };
  }, [qty, tiers]);
}

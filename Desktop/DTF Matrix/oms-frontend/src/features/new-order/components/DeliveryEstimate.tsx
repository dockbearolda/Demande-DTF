import { memo, useMemo } from "react";
import {
  computeDeliveryEstimate,
  formatDelayRange,
  type DeliveryEstimate as Estimate,
} from "../constants/delivery";
import { formatEUR } from "../pricing";
import type { ProductCategoryId } from "../constants";

interface Props {
  categoryId: ProductCategoryId | null;
  totalQty: number;
  isUrgent: boolean;
  /** Sous-total HT hors urgence — sert à chiffrer le surcoût en €. */
  subtotal?: number;
  /** Compact rendering for sticky panels. */
  compact?: boolean;
}

/**
 * Affichage du délai de production estimé. Apparaît dès qu'un modèle + une
 * quantité sont sélectionnés. Bascule en orange si l'urgence est cochée.
 */
export const DeliveryEstimate = memo(function DeliveryEstimate({
  categoryId,
  totalQty,
  isUrgent,
  subtotal,
  compact = false,
}: Props) {
  const standardEstimate = useMemo<Estimate>(
    () => computeDeliveryEstimate(categoryId, totalQty, false),
    [categoryId, totalQty],
  );
  const expressEstimate = useMemo<Estimate>(
    () => computeDeliveryEstimate(categoryId, totalQty, true),
    [categoryId, totalQty],
  );

  if (!categoryId || totalQty <= 0) return null;

  if (isUrgent) {
    const surchargeRate = expressEstimate.surchargeRate;
    const surchargePct = Math.round(surchargeRate * 100);
    const hasMoney = typeof subtotal === "number" && subtotal > 0;
    const surchargeAmount = hasMoney ? (subtotal as number) * surchargeRate : 0;
    const finalTotal = hasMoney ? (subtotal as number) + surchargeAmount : 0;

    return (
      <div
        className={`rounded-lg border border-amber-300 bg-amber-50 ${
          compact ? "px-3 py-2.5" : "px-4 py-3"
        }`}
        role="status"
      >
        <div className="flex items-center gap-2">
          <BoltIcon className="h-3.5 w-3.5 flex-none text-amber-700" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Délai express
          </span>
        </div>
        <dl className="mt-2 space-y-1 text-[11px] leading-snug">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="flex-none text-amber-800">Standard</dt>
            <dd className="min-w-0 text-right text-amber-900/70 line-through tabular-nums">
              {formatDelayRange(standardEstimate)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="flex-none font-semibold text-amber-900">Express</dt>
            <dd className="min-w-0 text-right text-sm font-bold text-amber-900 tabular-nums">
              {formatDelayRange(expressEstimate)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 border-t border-amber-200/70 pt-1">
            <dt className="flex-none text-amber-800">Surcoût</dt>
            <dd className="min-w-0 text-right tabular-nums">
              {hasMoney ? (
                <>
                  <span className="font-semibold text-amber-900">
                    +{formatEUR(surchargeAmount)}
                  </span>
                  <span className="ml-1 text-amber-800/80">
                    (+{surchargePct}%)
                  </span>
                  <span className="block text-[10px] text-amber-800">
                    soit {formatEUR(finalTotal)} au total
                  </span>
                </>
              ) : (
                <span className="font-semibold text-amber-900">
                  +{surchargePct}%
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const earliestLabel = new Date(
    standardEstimate.earliestIso,
  ).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const latestLabel = new Date(standardEstimate.latestIso).toLocaleDateString(
    "fr-FR",
    { day: "2-digit", month: "short" },
  );

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <ClockIcon className="h-3.5 w-3.5 flex-none text-slate-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Délai estimé
        </span>
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900">
        {formatDelayRange(standardEstimate)}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-600">
        À partir de la validation du BAT · cible {earliestLabel} → {latestLabel}
      </div>
    </div>
  );
});

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

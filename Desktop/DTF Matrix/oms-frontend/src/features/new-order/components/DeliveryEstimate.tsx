import { memo, useMemo } from "react";
import {
  computeDeliveryEstimate,
  formatDelayRange,
  type DeliveryEstimate as Estimate,
} from "../constants/delivery";
import type { ProductCategoryId } from "../constants";

interface Props {
  categoryId: ProductCategoryId | null;
  totalQty: number;
  isUrgent: boolean;
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
  compact = false,
}: Props) {
  const estimate = useMemo<Estimate>(
    () => computeDeliveryEstimate(categoryId, totalQty, isUrgent),
    [categoryId, totalQty, isUrgent],
  );

  if (!categoryId || totalQty <= 0) return null;

  const earliestLabel = new Date(estimate.earliestIso).toLocaleDateString(
    "fr-FR",
    { day: "2-digit", month: "short" },
  );
  const latestLabel = new Date(estimate.latestIso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });

  if (isUrgent) {
    return (
      <div
        className={`rounded-lg border border-amber-300 bg-amber-50 ${
          compact ? "px-3 py-2" : "px-4 py-3"
        }`}
        role="status"
      >
        <div className="flex items-center gap-2">
          <BoltIcon className="h-3.5 w-3.5 flex-none text-amber-700" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Délai express
          </span>
        </div>
        <div className="mt-1 text-sm font-bold text-amber-900">
          {formatDelayRange(estimate)}
        </div>
        <div className="mt-0.5 text-[11px] text-amber-800">
          Cible {earliestLabel} → {latestLabel} · Surcoût appliqué (+
          {Math.round(estimate.surchargeRate * 100)}%)
        </div>
      </div>
    );
  }

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
        {formatDelayRange(estimate)}
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

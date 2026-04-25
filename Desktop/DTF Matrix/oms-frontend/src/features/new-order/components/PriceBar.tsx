import { memo, useMemo } from "react";
import { computeTotals, formatEUR } from "../pricing";
import { selectLine, useNewOrderStore } from "../store";

interface Props {
  submitting: boolean;
  onSubmit: () => void;
  onStudioBat?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}

/**
 * Live Pricing — unifié classic/textile.
 * Ne connaît que NormalizedLine via computeTotals() : 0 condition de mode.
 */
export const PriceBar = memo(function PriceBar({
  submitting,
  onSubmit,
  onStudioBat,
  onCancel,
  submitLabel = "Créer",
}: Props) {
  const line = useNewOrderStore(selectLine);
  const totals = useMemo(() => computeTotals(line), [line]);

  const hasQty = totals.totalQty > 0;

  return (
    <div className="sticky bottom-0 -mx-6 mt-8 border-t border-slate-200 bg-slate-50/95 px-6 pb-6 pt-5 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total estimé
          </span>
          <span className="font-mono text-[28px] font-extrabold tabular-nums text-slate-800 leading-none">
            {totals.subtotal > 0 ? formatEUR(totals.subtotal) : "—"}
          </span>
          {hasQty && totals.unitPrice > 0 && (
            <span className="text-xs text-slate-500">
              {totals.totalQty} × {formatEUR(totals.unitPrice)}
            </span>
          )}
          {totals.nextTier && totals.unitsToNextTier && (
            <span className="text-[11px] text-emerald-600">
              · +{totals.unitsToNextTier} pour {formatEUR(totals.nextTier.unitPrice)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-lg px-4 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              Annuler
            </button>
          )}
          {onStudioBat && (
            <button
              type="button"
              onClick={onStudioBat}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <BatIcon className="h-4 w-4" />
              Passer au Studio BAT
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50"
          >
            {submitting ? "Création…" : submitLabel}
            <kbd className="ml-0.5 inline-flex h-5 items-center gap-1 rounded bg-white/15 px-1.5 text-[10px] font-medium text-white/90">
              ⏎
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
});

function BatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

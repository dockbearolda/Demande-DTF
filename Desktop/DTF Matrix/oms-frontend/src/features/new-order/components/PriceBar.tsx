import { memo, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { computeTotals, formatEUR } from "../pricing";
import { selectLine, useNewOrderStore } from "../store";
import { isClassicLine } from "../types";

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
 *
 * Cas particulier sourcing : la ligne dépliée n'a pas de prix calculable
 * (chiffrage manuel par un manager). On affiche un bandeau dédié plutôt
 * qu'un "—" muet, qui laisserait l'utilisateur penser qu'il manque une
 * saisie côté formulaire.
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
  const isSourcing = !!line && isClassicLine(line) && !!line.isSourcingRequired;

  return (
    <div className="sticky bottom-0 -mx-6 mt-8 border-t border-slate-200 bg-slate-50/95 px-6 pb-6 pt-5 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isSourcing ? (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Sparkles size={18} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Tarif à chiffrer
              </span>
              <span className="text-[14px] font-semibold text-slate-800">
                {hasQty
                  ? `${totals.totalQty} pièce${totals.totalQty > 1 ? "s" : ""} hors catalogue`
                  : "Article hors catalogue"}
                <span className="ml-1 font-normal text-slate-500">
                  · prix défini après sourcing fournisseur
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total estimé
            </span>
            {totals.subtotal > 0 ? (
              <NumberRoller
                value={formatEUR(totals.subtotal)}
                fontSize={28}
                className="font-mono text-[28px] font-extrabold tabular-nums text-slate-800 leading-none"
              />
            ) : (
              <span className="font-mono text-[28px] font-extrabold text-slate-800 leading-none">—</span>
            )}
            {hasQty && totals.unitPrice > 0 && (
              <span className="text-xs text-slate-500">
                {totals.totalQty} × <NumberRoller
                  value={formatEUR(totals.unitPrice)}
                  fontSize={12}
                  className="font-mono tabular-nums"
                />
              </span>
            )}
            {totals.nextTier && totals.unitsToNextTier && (
              <span className="text-[11px] text-emerald-600">
                · +{totals.unitsToNextTier} pour <NumberRoller
                  value={formatEUR(totals.nextTier.unitPrice)}
                  fontSize={11}
                  className="font-mono tabular-nums"
                />
              </span>
            )}
          </div>
        )}

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
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4A6274] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a4e5d] disabled:opacity-40"
          >
            {submitting ? "Création…" : submitLabel}
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

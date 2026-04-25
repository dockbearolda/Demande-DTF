import { memo, useMemo } from "react";
import type { Order } from "@/lib/types";

type SessionEntry = { order: Order; productLabel: string; totalQty: number };
import {
  computeDeliveryEstimate,
  formatDelayRange,
} from "../constants/delivery";
import type { ProductCategoryId } from "../constants";
import { ProcessTimeline } from "./ProcessTimeline";

interface Props {
  order: Order;
  /** Catégorie utilisée pour calculer le délai. */
  categoryId: ProductCategoryId | null;
  /** Quantité totale de la commande, pour estimation de délai. */
  totalQty: number;
  /** Nom du client (affiché en évidence). */
  clientName: string;
  /** Marqueur urgent. */
  isUrgent: boolean;
  /** Cible de produit (T-shirt, plexi, etc.) pour le récap. */
  productLabel: string;
  /** "Voir la commande" → page commande. */
  onViewOrder: () => void;
  /** "Créer une autre commande" → reset complet + retour. */
  onCreateAnother: () => void;
  /** "Ajouter un article" → conserve le client, réinitialise seulement la ligne. */
  onAddAnotherItem?: () => void;
  /** Tous les articles créés durant cette session (le courant inclus). */
  sessionEntries?: SessionEntry[];
  /** Optionnel : "Passer au Studio BAT" pour les commandes textile. */
  onStudioBat?: () => void;
}

/**
 * SubmissionSummary — écran post-submission. Donne à l'opérateur :
 *   - confirmation visuelle (numéro de commande)
 *   - récap minimal (client, produit, délai, urgence)
 *   - prochaine action attendue (envoi BAT)
 *   - boutons d'action (voir / studio BAT / nouvelle commande)
 */
export const SubmissionSummary = memo(function SubmissionSummary({
  order,
  categoryId,
  totalQty,
  clientName,
  isUrgent,
  productLabel,
  sessionEntries,
  onViewOrder,
  onAddAnotherItem,
  onCreateAnother,
  onStudioBat,
}: Props) {
  const previousEntries = sessionEntries
    ? sessionEntries.filter((e) => e.order.id !== order.id)
    : [];
  const estimate = useMemo(
    () => computeDeliveryEstimate(categoryId, totalQty, isUrgent),
    [categoryId, totalQty, isUrgent],
  );

  const earliestLabel = new Date(estimate.earliestIso).toLocaleDateString(
    "fr-FR",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
        {/* Hero */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-6 sm:px-8">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Commande créée
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              <span className="font-mono tracking-tight">{order.reference}</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {clientName} · {productLabel}
              {totalQty > 0 && <> · {totalQty} pcs</>}
            </p>
          </div>
          {isUrgent && (
            <span className="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-amber-100 px-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-300">
              <BoltIcon className="h-3 w-3" />
              Urgent
            </span>
          )}
        </div>

        {/* Timeline */}
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Processus engagé
          </div>
          <ProcessTimeline current="saisie" />
        </div>

        {/* Next action */}
        <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-600 text-white">
                <span className="text-sm font-bold">1</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Prochaine action attendue
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">
                  BAT à envoyer au client sous 24 h
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Tant que le client n'a pas validé le BAT, la production n'est
                  pas lancée. Délai estimé après validation :{" "}
                  <strong className="text-slate-900">
                    {formatDelayRange(estimate)}
                  </strong>
                  {" "}· cible <strong className="text-slate-900">{earliestLabel}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Session cart — commandes précédentes pour ce client */}
        {previousEntries.length > 0 && (
          <div className="border-b border-slate-100 px-6 py-4 sm:px-8">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Déjà commandé pour ce client
            </div>
            <ul className="space-y-1.5">
              {previousEntries.map((e) => (
                <li key={e.order.id} className="flex items-center gap-2 text-[12px] text-slate-700">
                  <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckSmallIcon />
                  </span>
                  <span className="font-mono font-semibold text-slate-500">{e.order.reference}</span>
                  <span className="text-slate-400">·</span>
                  <span>{e.productLabel}</span>
                  {e.totalQty > 0 && (
                    <span className="ml-auto text-slate-400">{e.totalQty} pcs</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={onCreateAnother}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Nouvelle commande
          </button>
          {onAddAnotherItem && (
            <button
              type="button"
              onClick={onAddAnotherItem}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <PlusIcon className="h-4 w-4" />
              Ajouter un article
            </button>
          )}
          {onStudioBat && (
            <button
              type="button"
              onClick={onStudioBat}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            >
              <BatIcon className="h-4 w-4" />
              Préparer le BAT
            </button>
          )}
          <button
            type="button"
            onClick={onViewOrder}
            className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Voir la commande
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

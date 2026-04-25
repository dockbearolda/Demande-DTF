import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { TEXTILE_MODELS } from "../constants";
import { computeTotals, formatEUR } from "../pricing";
import type { OrderHeader, TextileLine } from "../types";

interface Props {
  open: boolean;
  header: OrderHeader;
  line: TextileLine;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const VAT_RATE = 0.085; // 8.5% TVA Guadeloupe

export function QuotePreviewModal({
  open,
  header,
  line,
  submitting = false,
  onClose,
  onConfirm,
}: Props) {
  const model = useMemo(
    () => TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null,
    [line.modelId],
  );

  const totals = useMemo(() => computeTotals(line), [line]);

  const itemsByLine = useMemo(() => {
    if (!model) return [];
    const rows = Object.values(line.items)
      .filter((it) => !it.isPlaceholder && it.qty > 0)
      .map((it) => {
        const color = model.colors.find((c) => c.id === it.color);
        const size = model.sizes.find((s) => s.id === it.size);
        return {
          id: it.id,
          qty: it.qty,
          colorLabel: color?.label ?? it.color,
          colorHex: color?.hex ?? "#E5E7EB",
          colorBorder: color?.swatchBorder ?? false,
          sizeLabel: size?.label ?? it.size,
          unitPrice: totals.unitPrice,
          lineTotal: totals.unitPrice * it.qty,
        };
      });
    return rows;
  }, [line.items, model, totals.unitPrice]);

  const ttc = totals.subtotal;
  const ht = ttc > 0 ? ttc / (1 + VAT_RATE) : 0;
  const tva = ttc - ht;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const today = new Date();
  const dateStr = today.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm animate-in fade-in duration-150"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Header (toolbar) */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Étape 2/2 · Prévisualisation
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Document body (scrollable) */}
        <div className="flex-1 overflow-auto bg-slate-50/40 px-6 py-6 sm:px-10 sm:py-10">
          <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 sm:p-10">
            {/* Document header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <div className="inline-flex items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                    <LogoGlyph className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold tracking-tight text-slate-900">
                      DTF MATRIX
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      Atelier d'impression textile
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Devis
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                  #PREVIEW
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{dateStr}</div>
              </div>
            </div>

            {/* Client block */}
            <div className="grid grid-cols-2 gap-6 border-b border-slate-100 py-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Adressé à
                </div>
                <div className="mt-1.5 text-base font-semibold text-slate-900">
                  {header.clientNom || "—"}
                </div>
                {header.telephone && (
                  <div className="mt-0.5 text-sm text-slate-500 tabular-nums">
                    {header.telephone}
                  </div>
                )}
                {header.personneContact && (
                  <div className="text-sm text-slate-500">
                    À l'attention de {header.personneContact}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Produit
                </div>
                <div className="mt-1.5 text-base font-semibold text-slate-900">
                  {model?.name ?? "—"}
                </div>
                <div className="mt-0.5 font-mono text-xs font-medium text-slate-500">
                  Réf. {model?.reference}
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div className="py-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Qté
                    </th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      P.U.
                    </th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itemsByLine.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`h-4 w-4 flex-none rounded-full ${
                              r.colorBorder ? "ring-1 ring-slate-200" : ""
                            }`}
                            style={{ backgroundColor: r.colorHex }}
                          />
                          <span className="text-sm text-slate-800">
                            <span className="font-medium">{model?.name}</span>
                            <span className="text-slate-500">
                              {" "}
                              · {r.colorLabel} · Taille {r.sizeLabel}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">
                        {r.qty}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-500">
                        {formatEUR(r.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatEUR(r.lineTotal)}
                      </td>
                    </tr>
                  ))}
                  {itemsByLine.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-4 text-center text-xs text-slate-400"
                      >
                        Aucune ligne
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end border-t border-slate-100 pt-5">
              <div className="w-full max-w-xs space-y-1.5">
                <Row label="Sous-total HT" value={formatEUR(ht)} />
                <Row label={`TVA (${(VAT_RATE * 100).toFixed(1)}%)`} value={formatEUR(tva)} />
                <div className="mt-2 flex items-baseline justify-between border-t-2 border-slate-900 pt-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total TTC
                  </span>
                  <span className="font-mono text-xl font-bold tabular-nums text-slate-900">
                    {formatEUR(ttc)}
                  </span>
                </div>
                {totals.totalQty > 0 && (
                  <div className="pt-1 text-right text-[11px] text-slate-400 tabular-nums">
                    {totals.totalQty} pièces au tarif {formatEUR(totals.unitPrice)} HT
                  </div>
                )}
              </div>
            </div>

            {/* Footer note */}
            {header.notes?.trim() && (
              <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                <div className="mb-1 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  Notes
                </div>
                {header.notes}
              </div>
            )}
            <div className="mt-6 text-center text-[10px] text-slate-400">
              Devis valable 30 jours · Conditions de production standard
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <BackIcon className="h-4 w-4" />
            Modifier
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Envoi en cours…
              </>
            ) : (
              <>
                Confirmer & Envoyer
                <CheckIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-800">{value}</span>
    </div>
  );
}

function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h14a4 4 0 0 1 0 14H3z" />
      <path d="M3 12h10" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

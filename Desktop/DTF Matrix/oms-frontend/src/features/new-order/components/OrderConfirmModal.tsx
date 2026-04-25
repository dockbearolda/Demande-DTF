import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { OPERATEURS, TEXTILE_MODELS, type ProductCategoryId } from "../constants";
import { computeTotals, formatEUR, getLogoSurcharge } from "../pricing";
import {
  isClassicLine,
  isTextileLine,
  type OrderHeader,
  type OrderLine,
} from "../types";
import {
  computeDeliveryEstimate,
  formatDelayRange,
} from "../constants/delivery";

interface Props {
  open: boolean;
  header: OrderHeader;
  line: OrderLine | null;
  /** Used for the delivery-estimate hint inside the recap. */
  categoryId?: ProductCategoryId | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const PLACEMENT_LABEL: Record<string, string> = {
  "front-heart": "Avant (cœur)",
  "front-center": "Avant (centre)",
  back: "Arrière",
  "front-back": "Avant + Arrière",
};

/**
 * OrderConfirmModal — final recap modal shown right before order creation.
 * Two CTAs: "Modifier" (close) / "Confirmer la commande".
 */
export function OrderConfirmModal({
  open,
  header,
  line,
  categoryId = null,
  submitting = false,
  onClose,
  onConfirm,
}: Props) {
  const totals = useMemo(() => computeTotals(line), [line]);
  const estimate = useMemo(
    () => computeDeliveryEstimate(categoryId, totals.totalQty, header.isUrgent),
    [categoryId, totals.totalQty, header.isUrgent],
  );

  /** Date limite de modification = 24 h avant l'envoi du BAT, soit demain en pratique. */
  const modificationDeadline = useMemo(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    // Si on est après 18h, repousse à demain 18h.
    if (Date.now() > d.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const modificationDeadlineLabel = modificationDeadline.toLocaleDateString(
    "fr-FR",
    { weekday: "long", day: "2-digit", month: "long" },
  ) + ", 18 h";

  const earliestLabel = new Date(estimate.earliestIso).toLocaleDateString(
    "fr-FR",
    { day: "2-digit", month: "long" },
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open || !line) return null;

  const operator = OPERATEURS.find((op) => op.value === header.assignedTo);

  const productLabel = isClassicLine(line)
    ? line.customProduit?.trim() || line.produit
    : isTextileLine(line)
      ? line.modelName || "Textile"
      : "—";

  const sectorLabel = isClassicLine(line)
    ? line.secteur
    : isTextileLine(line)
      ? "Textiles"
      : "—";

  const items = isTextileLine(line)
    ? Object.values(line.items).filter((it) => !it.isPlaceholder && it.qty > 0)
    : [];

  const textileModel = isTextileLine(line)
    ? TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null
    : null;

  const dateDisplay = header.dateLivraison
    ? new Date(header.dateLivraison).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Non précisée";

  const placementLabel =
    isTextileLine(line) && line.logoPlacement
      ? PLACEMENT_LABEL[line.logoPlacement]
      : "Sans logo";

  // Mockup thumbnail (first available side)
  const mockupSrc =
    isTextileLine(line)
      ? line.design.front?.mockupDataUrl ??
        line.design.back?.mockupDataUrl ??
        line.design.sleeves?.mockupDataUrl ??
        null
      : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm animate-in fade-in duration-150"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
              <CheckIcon className="h-3 w-3" />
              Récapitulatif final
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

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 sm:px-8 sm:py-6">
          {/* Hero: produit + miniature */}
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
              {mockupSrc ? (
                <img
                  src={mockupSrc}
                  alt={productLabel}
                  className="h-full w-full object-contain"
                />
              ) : (
                <ProductGlyph className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {sectorLabel}
              </div>
              <div className="mt-0.5 text-base font-bold text-slate-900">
                {productLabel}
              </div>
              {textileModel && (
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  Réf. {textileModel.reference}
                </div>
              )}
              {totals.totalQty > 0 && (
                <div className="mt-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {totals.totalQty} pièces
                  </span>
                  {totals.unitPrice > 0 && (
                    <> · {formatEUR(totals.unitPrice)} /u.</>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tailles / quantités */}
          {isTextileLine(line) && items.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Tailles & Quantités
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((it) => {
                      const c = textileModel?.colors.find((x) => x.id === it.color);
                      const sz = textileModel?.sizes.find((x) => x.id === it.size);
                      return (
                        <tr
                          key={it.id}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`h-4 w-4 flex-none rounded-full ${
                                  c?.swatchBorder ? "ring-1 ring-slate-200" : ""
                                }`}
                                style={{ backgroundColor: c?.hex ?? "#E5E7EB" }}
                              />
                              <span className="text-slate-700">
                                {c?.label ?? it.color} ·{" "}
                                <span className="font-medium text-slate-900">
                                  Taille {sz?.label ?? it.size}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="w-20 px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums text-slate-800">
                            {it.qty}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Logo placement */}
          {isTextileLine(line) && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Placement du logo
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-800">
                  {placementLabel}
                </div>
              </div>
              {line.logoPlacement && (
                <span className="inline-flex h-7 items-center rounded-full bg-indigo-50 px-2.5 font-mono text-xs font-bold text-indigo-700">
                  +{getLogoSurcharge(line.logoPlacement).toFixed(2)}€
                </span>
              )}
            </div>
          )}

          {/* Client + Livraison */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoCard label="Client" value={header.clientNom || "—"} sub={header.telephone} />
            <InfoCard
              label="Personne à joindre"
              value={header.personneContact || "—"}
            />
            <InfoCard
              label="Assigné à"
              value={operator?.name ?? "—"}
            />
            <InfoCard
              label="Date de livraison"
              value={dateDisplay}
              accent={header.isUrgent ? "danger" : undefined}
              sub={header.isUrgent ? "URGENT" : undefined}
            />
          </div>

          {header.notes?.trim() && (
            <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900 ring-1 ring-amber-200">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Note
              </div>
              {header.notes}
            </div>
          )}

          {/* Total */}
          <div className="mt-5 flex items-baseline justify-between rounded-xl bg-slate-900 px-5 py-4 text-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Total estimé
            </span>
            <span className="font-mono text-2xl font-extrabold tabular-nums">
              {totals.subtotal > 0 ? formatEUR(totals.subtotal) : "—"}
            </span>
          </div>

          {/* Engagement / point de non-retour */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-200 text-amber-800">
                <AlertIcon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-amber-900">
                <div className="font-semibold text-amber-950">
                  Engagement de production
                </div>
                <p className="mt-1">
                  Délai estimé après validation client :{" "}
                  <strong>{formatDelayRange(estimate)}</strong>
                  {totals.totalQty > 0 && <> · cible <strong>{earliestLabel}</strong></>}.
                </p>
                <p className="mt-1.5">
                  Modification possible jusqu'au{" "}
                  <strong className="text-amber-950">{modificationDeadlineLabel}</strong>.
                  Au-delà, le BAT part au client et la production est engagée.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <BackIcon className="h-4 w-4" />
            Modifier
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            title="Après validation, le BAT part en production automatiquement si non contesté sous 48 h"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Création…
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                Créer la commande
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ───────── Helpers ─────────

function InfoCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "danger";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        accent === "danger"
          ? "border-rose-200 bg-rose-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-semibold ${
          accent === "danger" ? "text-rose-700" : "text-slate-800"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-0.5 text-[11px] ${
            accent === "danger" ? "font-bold text-rose-600" : "text-slate-500"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ───────── Icons ─────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ProductGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7l4-3 2 2h4l2-2 4 3-2 4-2-1v9H8v-9l-2 1z" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
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
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12" y2="17" />
    </svg>
  );
}

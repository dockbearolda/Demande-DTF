import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { TEXTILE_MODELS } from "../constants";
import { computeTotals, formatEUR, getLogoSurcharge } from "../pricing";
import type { OrderHeader, TextileLine } from "../types";

interface Props {
  open: boolean;
  header: OrderHeader;
  line: TextileLine;
  submitting?: boolean;
  onClose: () => void;
  onCancelOrder: () => void;
  onSaveToFolder: () => void;
  onSendToClient: () => void;
  onAddToOrder: () => void;
}

const VAT_RATE = 0.085;

export function QuotePreviewModal({
  open,
  header,
  line,
  submitting = false,
  onClose,
  onCancelOrder,
  onSaveToFolder,
  onSendToClient,
  onAddToOrder,
}: Props) {
  const model = useMemo(
    () => TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null,
    [line.modelId],
  );

  const totals = useMemo(() => computeTotals(line), [line]);

  const itemsByLine = useMemo(() => {
    if (!model) return [];
    return Object.values(line.items)
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
  }, [line.items, model, totals.unitPrice]);

  const ttc = totals.subtotal;
  const ht = ttc > 0 ? ttc / (1 + VAT_RATE) : 0;
  const tva = ttc - ht;

  // Mockup sides with content
  const mockupSides = useMemo(() => {
    const sides: { label: string; mockupUrl: string | null; logoUrl: string | null }[] = [];
    if (line.design.front?.mockupDataUrl) {
      sides.push({
        label: "Avant",
        mockupUrl: line.design.front.mockupDataUrl,
        logoUrl: line.design.front.logoDataUrl,
      });
    }
    if (line.design.back?.mockupDataUrl) {
      sides.push({
        label: "Arrière",
        mockupUrl: line.design.back.mockupDataUrl,
        logoUrl: line.design.back.logoDataUrl,
      });
    }
    if (line.design.sleeves?.mockupDataUrl) {
      sides.push({
        label: "Manches",
        mockupUrl: line.design.sleeves.mockupDataUrl,
        logoUrl: line.design.sleeves.logoDataUrl,
      });
    }
    return sides;
  }, [line.design]);

  const hasMockups = mockupSides.length > 0;

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
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Récapitulatif commande
            </span>
            {hasMockups && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-indigo-50 px-2.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                <MockupIcon className="h-3 w-3" />
                BAT joint
              </span>
            )}
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

        {/* Scrollable document body */}
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
                    <div className="text-sm font-bold tracking-tight text-slate-900">DTF MATRIX</div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      Atelier d'impression textile
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Devis</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">#PREVIEW</div>
                <div className="mt-0.5 text-xs text-slate-500">{dateStr}</div>
              </div>
            </div>

            {/* Client + produit */}
            <div className="grid grid-cols-2 gap-6 border-b border-slate-100 py-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Adressé à
                </div>
                {header.clientNom ? (
                  <>
                    <div className="mt-1.5 text-base font-semibold text-slate-900">
                      {header.clientNom}
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
                  </>
                ) : (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                    <WarnIcon className="h-3.5 w-3.5" />
                    Client non renseigné
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Produit</div>
                <div className="mt-1.5 text-base font-semibold text-slate-900">
                  {model?.name ?? "—"}
                </div>
                <div className="mt-0.5 font-mono text-xs font-medium text-slate-500">
                  Réf. {model?.reference}
                </div>
              </div>
            </div>

            {/* BAT Mockups */}
            {hasMockups && (
              <div className="border-b border-slate-100 py-5">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  BAT — Visuels mockup
                </div>
                <div className="flex gap-4 overflow-x-auto pb-1">
                  {mockupSides.map((side) => (
                    <MockupCard key={side.label} side={side} />
                  ))}
                </div>
              </div>
            )}

            {/* Logo placement */}
            {line.logoPlacement && (
              <div className="border-b border-slate-100 py-5">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Placement du logo
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                  <LogoIcon className="h-4 w-4 text-slate-600" />
                  {{
                    "front-heart": "Avant (cœur)",
                    "front-center": "Avant (centre)",
                    back: "Arrière",
                    "front-back": "Avant + Arrière",
                  }[line.logoPlacement]}
                  <span className="ml-1 text-slate-500">
                    +{getLogoSurcharge(line.logoPlacement).toFixed(2)}€
                  </span>
                </div>
              </div>
            )}

            {/* Line items */}
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
                            className={`h-4 w-4 flex-none rounded-full ${r.colorBorder ? "ring-1 ring-slate-200" : ""}`}
                            style={{ backgroundColor: r.colorHex }}
                          />
                          <span className="text-sm text-slate-800">
                            <span className="font-medium">{model?.name}</span>
                            <span className="text-slate-500"> · {r.colorLabel} · Taille {r.sizeLabel}</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{r.qty}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-500">{formatEUR(r.unitPrice)}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatEUR(r.lineTotal)}
                      </td>
                    </tr>
                  ))}
                  {itemsByLine.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-xs text-slate-400">
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total TTC</span>
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

            {/* Notes */}
            {header.notes?.trim() && (
              <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Notes</div>
                {header.notes}
              </div>
            )}
            <div className="mt-6 text-center text-[10px] text-slate-400">
              Devis valable 30 jours · Conditions de production standard
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="border-t border-slate-100 bg-white">
          {/* Top row: destructive + back */}
          <div className="flex items-center justify-between gap-2 px-6 pt-3 pb-2">
            <button
              type="button"
              onClick={onCancelOrder}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Annuler la commande
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <BackIcon className="h-4 w-4" />
              Modifier
            </button>
          </div>

          {/* Bottom row: primary actions */}
          <div className="flex items-center justify-end gap-2 px-6 pb-4">
            <button
              type="button"
              onClick={onSaveToFolder}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderIcon className="h-4 w-4" />
              Sauvegarder
            </button>
            <button
              type="button"
              onClick={onSendToClient}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
            >
              {submitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
              Envoyer au client
            </button>
            <button
              type="button"
              onClick={onAddToOrder}
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Création…
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
                  Ajouter au commande
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Mockup card ───

function MockupCard({
  side,
}: {
  side: { label: string; mockupUrl: string | null; logoUrl: string | null };
}) {
  return (
    <div className="flex-none">
      <div className="relative h-36 w-28 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
        {side.mockupUrl && (
          <img
            src={side.mockupUrl}
            alt={`Mockup ${side.label}`}
            className="h-full w-full object-contain"
          />
        )}
        {side.logoUrl && (
          <img
            src={side.logoUrl}
            alt="Logo"
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>
      <div className="mt-1.5 text-center text-[10px] font-medium text-slate-500">
        {side.label}
      </div>
    </div>
  );
}

// ─── Small helpers ───

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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h14a4 4 0 0 1 0 14H3z" />
      <path d="M3 12h10" />
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MockupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6v12M6 12h12" />
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

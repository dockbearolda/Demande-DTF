import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { OPERATEURS } from "../constants";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { getTextileModel } from "../runtimeCatalog";
import { computeTotals, formatEUR } from "../pricing";
import {
  isClassicLine,
  isTextileLine,
  type OrderHeader,
  type OrderLine,
  type OrderLineRecord,
} from "../types";

export type WizardStepTarget = 1 | 2 | 3 | 4;

interface Props {
  open: boolean;
  header: OrderHeader;
  /** The currently-expanded line in the wizard, used as the hero in single-line mode. */
  line: OrderLine | null;
  /** All references in the draft. Used to render a multi-reference recap and to
   *  aggregate the total across every line. Falls back to `[line]` when omitted
   *  so legacy callers continue to work. */
  lines?: ReadonlyArray<OrderLineRecord>;
  submitting?: boolean;
  /** Surfaced inline in the footer when the submission fails. */
  error?: string | null;
  /** Default contact attached to the selected client (for the fallback hint). */
  defaultClientContact?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  /** Jump back to a specific wizard step from a section's "Modifier ↗" link. */
  onEditStep?: (step: WizardStepTarget) => void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * OrderConfirmModal — final recap (S10) before order creation.
 *
 * Keyboard contract:
 *  - Enter      → confirm (mirrors the green primary button)
 *  - Escape     → close + return to the previous wizard step
 *  - Tab cycle  → trapped inside the modal
 *  - On open    → focus lands on "Créer la commande"
 *  - On close   → focus returns to the element that opened the modal
 */
export function OrderConfirmModal({
  open,
  header,
  line,
  lines,
  submitting = false,
  error = null,
  defaultClientContact = null,
  onClose,
  onConfirm,
  onEditStep,
}: Props) {
  // Use every line in the draft for totals and the multi-reference recap.
  // Falls back to the single `line` prop for legacy mono-line call sites.
  const allLines = useMemo<OrderLine[]>(() => {
    if (lines && lines.length > 0) return lines.map((r) => r.line);
    return line ? [line] : [];
  }, [lines, line]);

  // The "hero" line displayed at the top — the expanded one if any, else the
  // last drafted reference, so the modal always has something concrete to show.
  const displayLine: OrderLine | null = line ?? allLines[allLines.length - 1] ?? null;

  // Aggregate totals across every reference. Single-line orders preserve the
  // existing behaviour (sum is identical to the per-line total).
  const totals = useMemo(() => {
    if (allLines.length <= 1) return computeTotals(displayLine);
    return allLines.reduce(
      (acc, l) => {
        const t = computeTotals(l);
        return {
          totalQty: acc.totalQty + t.totalQty,
          subtotal: acc.subtotal + t.subtotal,
          colorChangeFee: acc.colorChangeFee + t.colorChangeFee,
          // Per-line fields aren't meaningful on the aggregate — surface them
          // as zero/null so callers don't accidentally rely on them.
          unitPrice: 0,
          distinctColorCount: 0,
          appliedTier: null,
          nextTier: null,
          unitsToNextTier: null,
        };
      },
      {
        totalQty: 0,
        subtotal: 0,
        colorChangeFee: 0,
        unitPrice: 0,
        distinctColorCount: 0,
        appliedTier: null,
        nextTier: null,
        unitsToNextTier: null,
      },
    );
  }, [allLines, displayLine]);
  const isMulti = allLines.length > 1;
  const heroTotals = useMemo(() => computeTotals(displayLine), [displayLine]);

  // ───────── Refs for focus management ─────────
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Capture the trigger before opening, restore after closing.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    } else if (previouslyFocusedRef.current) {
      const el = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      // Defer to next frame so the closing transition doesn't steal focus back.
      window.requestAnimationFrame(() => el.focus({ preventScroll: true }));
    }
  }, [open]);

  // Auto-focus the primary CTA when the modal opens.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      confirmBtnRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  // Keyboard handling: Esc close, Enter confirm, Tab focus trap.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (submitting) return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Enter") {
        // Don't hijack Enter when the user is inside a textarea or a custom
        // listbox/combobox — the recap has none today, but stay defensive.
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === "TEXTAREA" ||
            t.getAttribute("role") === "combobox" ||
            t.getAttribute("role") === "option")
        ) {
          return;
        }
        // If focus sits on a non-primary button (e.g. Modifier, Modifier ↗),
        // let Enter activate that button instead of force-confirming.
        if (t && t.tagName === "BUTTON" && t !== confirmBtnRef.current) return;
        if (submitting) return;
        e.preventDefault();
        onConfirm();
        return;
      }
      if (e.key === "Tab") {
        const root = modalRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onConfirm, submitting]);

  const handleEdit = useCallback(
    (step: WizardStepTarget) => {
      if (submitting) return;
      // Closing first lets focus restoration run before navigation kicks in.
      onEditStep?.(step);
      onClose();
    },
    [onEditStep, onClose, submitting],
  );

  if (!open || !displayLine) return null;

  const operator = OPERATEURS.find((op) => op.value === header.assignedTo);

  const productLabel = isClassicLine(displayLine)
    ? displayLine.customProduit?.trim() || displayLine.produit
    : isTextileLine(displayLine)
      ? displayLine.modelName || "Textile"
      : "—";

  const sectorLabel = isClassicLine(displayLine)
    ? displayLine.secteur
    : isTextileLine(displayLine)
      ? "Textiles"
      : "—";

  // Agrège par (color, size) — le store autorise plusieurs `TextileItem` avec
  // la même paire couleur/taille (chacun ayant son propre id), ce qui faisait
  // apparaître « Marine · XS = 1 » deux fois au lieu d'un seul « = 2 ».
  // En multi-références, on masque ce tableau (trop de lignes à la fois).
  const items = !isMulti && isTextileLine(displayLine)
    ? Object.values(
        Object.values(displayLine.items)
          .filter((it) => !it.isPlaceholder && it.qty > 0)
          .reduce<Record<string, { color: string; size: string; qty: number }>>(
            (acc, it) => {
              const key = `${it.color}__${it.size}`;
              if (acc[key]) acc[key].qty += it.qty;
              else acc[key] = { color: it.color, size: it.size, qty: it.qty };
              return acc;
            },
            {},
          ),
      )
    : [];

  const textileModel = isTextileLine(displayLine)
    ? getTextileModel(displayLine.modelId) ?? null
    : null;

  const dateDisplay = header.dateLivraison
    ? new Date(header.dateLivraison).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Non précisée";

  const mockupSrc =
    isTextileLine(displayLine)
      ? displayLine.design.front?.mockupDataUrl ??
        displayLine.design.back?.mockupDataUrl ??
        displayLine.design.sleeves?.mockupDataUrl ??
        null
      : null;

  const contactRaw = header.personneContact?.trim() ?? "";
  const hasContact = contactRaw.length > 0;
  const fallbackContact = defaultClientContact?.trim() || null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm animate-in fade-in duration-150"
      />

      <div
        ref={modalRef}
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5">
          <div className="inline-flex items-center gap-2">
            <span
              id="confirm-modal-title"
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200"
            >
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
          <SectionHeader
            label="Produit"
            onEdit={onEditStep ? () => handleEdit(2) : undefined}
            editLabel="Modifier le produit"
          />
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
              {heroTotals.totalQty > 0 && (
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold text-slate-800">
                    {heroTotals.totalQty} pièces
                  </span>
                  {heroTotals.unitPrice > 0 && (
                    <span className="inline-flex items-baseline gap-1">
                      <NumberRoller
                        value={formatEUR(heroTotals.unitPrice)}
                        fontSize={24}
                        className="font-mono text-2xl font-extrabold tabular-nums leading-none"
                        style={{ color: "var(--brand-duck-500)" }}
                      />
                      <span className="text-[11px] font-medium text-slate-500">
                        /unité
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {isMulti && (
            <MultiLineRecap lines={allLines} displayLine={displayLine} />
          )}

          {/* Tailles / quantités */}
          {isTextileLine(displayLine) && items.length > 0 && (
            <div className="mt-4">
              <SectionHeader
                label="Tailles & Quantités"
                onEdit={onEditStep ? () => handleEdit(2) : undefined}
                editLabel="Modifier les tailles et couleurs"
              />
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((it) => {
                      const c = textileModel?.colors.find((x) => x.id === it.color);
                      const sz = textileModel?.sizes.find((x) => x.id === it.size);
                      return (
                        <tr
                          key={`${it.color}__${it.size}`}
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

          {/* Client */}
          <div className="mt-4">
            <SectionHeader
              label="Client"
              onEdit={onEditStep ? () => handleEdit(1) : undefined}
              editLabel="Modifier le client et l'opérateur"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                label="Client"
                value={header.clientNom || "—"}
                sub={header.telephone}
              />
              <ContactCard
                value={contactRaw}
                hasValue={hasContact}
                fallback={fallbackContact}
                onDefineSpecific={
                  onEditStep ? () => handleEdit(1) : undefined
                }
              />
              <InfoCard label="Assigné à" value={operator?.name ?? "—"} />
            </div>
          </div>

          {/* Livraison */}
          <div className="mt-4">
            <SectionHeader
              label="Livraison"
              onEdit={onEditStep ? () => handleEdit(4) : undefined}
              editLabel="Modifier la date de livraison"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                label="Date de livraison"
                value={dateDisplay}
                accent={header.isUrgent ? "danger" : undefined}
                sub={header.isUrgent ? "URGENT" : undefined}
                onEdit={onEditStep ? () => handleEdit(4) : undefined}
                editLabel="Modifier la date"
              />
            </div>
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
            {totals.subtotal > 0 ? (
              <NumberRoller
                value={formatEUR(totals.subtotal)}
                fontSize={24}
                className="font-mono text-2xl font-extrabold tabular-nums"
              />
            ) : (
              <span className="font-mono text-2xl font-extrabold">—</span>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-white px-6 py-4">
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5"
            >
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-4 w-4 flex-none text-rose-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold leading-snug text-rose-900">
                  Échec de la création
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-rose-800">
                  {error}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              data-testid="modal-cancel-btn"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              <BackIcon className="h-4 w-4" />
              <span>Modifier</span>
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              data-testid="modal-confirm-btn"
              title="Après validation, le BAT part en production automatiquement si non contesté sous 48 h"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4A6274] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a4e5d] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6274] focus-visible:ring-offset-2"
            >
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>Création…</span>
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  <span>{error ? "Réessayer" : "Créer la commande"}</span>
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

// ───────── Helpers ─────────

/** Multi-reference recap: lists every drafted line with its quantity and the
 *  per-line subtotal. The currently-displayed line (hero above) is highlighted
 *  so the user keeps context on which one the hero refers to. */
function MultiLineRecap({
  lines,
  displayLine,
}: {
  lines: ReadonlyArray<OrderLine>;
  displayLine: OrderLine;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {lines.length} référence{lines.length > 1 ? "s" : ""} dans cette commande
        </div>
      </div>
      <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-2">
        {lines.map((l, idx) => {
          const t = computeTotals(l);
          const label = isClassicLine(l)
            ? l.customProduit?.trim() || l.produit || "—"
            : isTextileLine(l)
              ? l.modelName || "Textile"
              : "—";
          const sector = isClassicLine(l) ? l.secteur : "Textiles";
          const isHero = l === displayLine;
          const isSourcing = isClassicLine(l) && !!l.isSourcingRequired;
          return (
            <li
              key={idx}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${
                isHero
                  ? isSourcing
                    ? "bg-amber-50/60 ring-1 ring-amber-300"
                    : "bg-slate-50 ring-1 ring-slate-200"
                  : isSourcing
                    ? "bg-amber-50/30"
                    : ""
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                #{idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-slate-800">
                    {label}
                  </span>
                  {isSourcing && (
                    <span
                      className="flex-none rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800"
                      title="Article hors catalogue — sourcing requis"
                    >
                      ✨ Sourcing
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {isSourcing ? "Hors catalogue" : sector}
                  {t.totalQty > 0 ? ` · ${t.totalQty} pièces` : ""}
                </div>
              </div>
              <div className="font-mono text-[12px] font-semibold tabular-nums text-slate-700">
                {isSourcing && t.subtotal === 0
                  ? <span className="text-amber-700">À chiffrer</span>
                  : t.subtotal > 0
                    ? <NumberRoller value={formatEUR(t.subtotal)} fontSize={12} className="font-mono font-semibold tabular-nums" />
                    : "—"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SectionHeader({
  label,
  onEdit,
  editLabel,
}: {
  label: string;
  onEdit?: () => void;
  editLabel: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[#4A6274] transition hover:bg-[#4A6274]/10 hover:text-[#3a4e5d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6274]/40"
        >
          Modifier
          <ArrowUpRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  sub,
  accent,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "danger";
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <div
      className={`relative rounded-xl border px-4 py-3 ${
        accent === "danger"
          ? "border-rose-200 bg-rose-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={editLabel ?? `Modifier ${label}`}
            className="inline-flex h-5 items-center gap-0.5 rounded text-[10px] font-semibold text-blue-600 transition hover:text-[#3a4e5d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6274]/40"
          >
            Modifier
            <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        )}
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

function ContactCard({
  value,
  hasValue,
  fallback,
  onDefineSpecific,
}: {
  value: string;
  hasValue: boolean;
  fallback: string | null;
  onDefineSpecific?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Personne à joindre
      </div>
      {hasValue ? (
        <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
      ) : (
        <>
          {fallback ? (
            <div className="mt-0.5 text-[12px] italic leading-snug text-slate-500">
              Aucun contact spécifique défini (par défaut :{" "}
              <span className="font-semibold not-italic text-slate-700">
                {fallback}
              </span>
              )
            </div>
          ) : (
            <div className="mt-0.5 text-[12px] italic text-slate-400">
              Aucun contact spécifique défini
            </div>
          )}
          {onDefineSpecific && (
            <button
              type="button"
              onClick={onDefineSpecific}
              className="mt-1.5 inline-flex h-6 items-center gap-0.5 rounded text-[11px] font-semibold text-blue-600 transition hover:text-[#3a4e5d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6274]/40"
            >
              Définir un contact spécifique
              <ArrowUpRight className="h-2.5 w-2.5" />
            </button>
          )}
        </>
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

function ArrowUpRight({ className }: { className?: string }) {
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
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="8 7 17 7 17 16" />
    </svg>
  );
}

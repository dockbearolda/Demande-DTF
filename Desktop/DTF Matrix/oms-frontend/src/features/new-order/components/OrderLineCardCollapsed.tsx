import { useState } from "react";
import { ChevronDown, Copy, Pencil, Trash2, GripVertical, Image as ImageIcon, Sparkles } from "lucide-react";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { isClassicLine, isTextileLine } from "../types";
import type { OrderLine } from "../types";
import { ProductIcon } from "./ProductIcon";
import type { ProductTarget } from "./ProductIcon";
import { getTextileModel } from "../runtimeCatalog";
import { computeTotals, formatEUR } from "../pricing";
import { effectivePersonalizationMode } from "../store";

interface Props {
  /** Stable line id (UUID, used as React key in the parent). */
  id: string;
  /** Position in the list — shown as a 1-based badge. */
  index: number;
  line: OrderLine;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Optional — when omitted the action is hidden. Textile lines only. */
  onCopyArtwork?: () => void;
  /** Optional drag handle props (from @dnd-kit). When provided, a handle is
   *  rendered on the left side of the card. */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  /** When true, render in active state (full opacity, accent ring, chevron pointing
   *  down). Other items in the list should be visually demoted. */
  expanded?: boolean;
  /** When true, demote the card visually (slight opacity drop, muted bg) to
   *  signal it's secondary. Has no effect when `expanded` is true. */
  demoted?: boolean;
  /** Show a chevron affordance on the right edge — signals the row is
   *  clickable to expand/collapse. Defaults to true. */
  showChevron?: boolean;
  /** When true, the card drops its own border/rounded/bg/shadow because the
   *  host (a unified reference container) provides them. Only opacity for
   *  the demoted state remains, so the row blends seamlessly into the parent. */
  borderless?: boolean;
}

/**
 * Compact recap shown when a line is collapsed in the accordion.
 *
 * Reads:
 *   - vignette (model thumbnail or color hex chip),
 *   - product name + supplier ref,
 *   - declension summary "Black ×12 · White ×8 · +N",
 *   - total qty and subtotal HT,
 *   - quick actions on the right.
 *
 * Designed to be lightweight (no inline editing here) so a list of 10+ cards
 * scrolls smoothly. Wrap with `React.memo` at the call site if needed.
 */
export function OrderLineCardCollapsed({
  index,
  line,
  onEdit,
  onDuplicate,
  onDelete,
  onCopyArtwork,
  dragHandleProps,
  expanded = false,
  demoted = false,
  showChevron = true,
  borderless = false,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totals = computeTotals(line);
  const summary = describeLine(line);
  const isSourcing = isClassicLine(line) && !!line.isSourcingRequired;
  const isEmpty = isTextileLine(line) && !line.modelId;

  // Badge perso — résume la décision de l'utilisateur sur la référence textile :
  //   "without"     → SANS PERSO (neutre positif, pas d'alerte)
  //   "with" sans BAT → À PERSONNALISER (amber)
  //   null (non décidé) → À DÉCIDER (amber, encourage à trancher)
  //   sinon (BAT prêt) → pas de badge
  const persoBadge: "sans-perso" | "to-personalize" | "to-decide" | null = (() => {
    if (!isTextileLine(line) || !line.modelId) return null;
    const tLine = line as import("../types").TextileLine;
    const mode = effectivePersonalizationMode(tLine);
    if (mode === "without") return "sans-perso";
    if (mode === null) return "to-decide";
    const hasDraft = Object.values(tLine.batDrafts ?? {}).some(
      (arr) => (arr?.length ?? 0) > 0,
    );
    const hasLinked = Object.keys(tLine.linkedBats ?? {}).length > 0;
    if (!hasDraft && !hasLinked) return "to-personalize";
    return null;
  })();

  // Sourcing : on remplace la base bg-white par une teinte ambrée discrète
  // pour démarquer la ligne dans la liste, tout en conservant les variantes
  // expanded/demoted pour la cohérence visuelle.
  // Borderless : la coque (border/rounded/bg/shadow) est fournie par le
  // conteneur parent unifié — on ne garde ici que l'opacité pour démoter.
  const stateClass = borderless
    ? expanded
      ? "opacity-100"
      : demoted
        ? "opacity-70 hover:opacity-100"
        : ""
    : expanded
      ? isSourcing
        ? "border-amber-400 bg-amber-50/40 shadow-md ring-1 ring-amber-500/10 opacity-100"
        : "border-slate-300 bg-white shadow-md ring-1 ring-slate-900/5 opacity-100"
      : demoted
        ? isSourcing
          ? "border-amber-200 bg-amber-50/30 opacity-70 hover:opacity-100 hover:border-amber-300 hover:bg-amber-50 hover:shadow"
          : "border-slate-200 bg-slate-50/60 opacity-70 hover:opacity-100 hover:border-slate-300 hover:bg-white hover:shadow"
        : isSourcing
          ? "border-amber-300 bg-amber-50/40 shadow-sm hover:border-amber-400 hover:shadow"
          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow";

  const chromeClass = borderless ? "" : "rounded-xl border";

  return (
    <div
      data-testid="order-line-card-collapsed"
      data-expanded={expanded || undefined}
      className={`group flex items-center gap-3 ${chromeClass} px-3 py-2.5 transition-[opacity,background-color,border-color,box-shadow] duration-200 ease-in-out ${stateClass}`}
      onClick={(e) => {
        // Avoid triggering edit if the click came from an action button.
        if ((e.target as HTMLElement).closest("[data-action]")) return;
        onEdit();
      }}
    >
      {dragHandleProps && (
        <button
          type="button"
          aria-label="Réordonner cette ligne"
          {...dragHandleProps}
          className="flex h-8 w-5 flex-none cursor-grab items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          data-action="drag"
        >
          <GripVertical size={16} />
        </button>
      )}

      <div
        className={`flex h-10 w-10 flex-none overflow-hidden rounded-lg border ${
          isSourcing
            ? "border-amber-300 bg-amber-100 text-amber-700"
            : "border-slate-200"
        }`}
      >
        {isSourcing ? (
          <div className="flex h-full w-full items-center justify-center">
            <Sparkles size={18} strokeWidth={2.25} aria-hidden="true" />
          </div>
        ) : isEmpty ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <span className="text-[11px] font-bold text-slate-400">#{index + 1}</span>
          </div>
        ) : summary.productTarget ? (
          <ProductIcon target={summary.productTarget} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-50">
            <ImageIcon size={18} className="text-slate-400" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            #{index + 1}
          </span>
          <h3 className="truncate text-[14px] font-semibold text-slate-800">
            {summary.title}
          </h3>
          {isSourcing && (
            <span
              className="flex flex-none items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800"
              title="Article hors catalogue — sourcing requis"
            >
              <Sparkles size={10} strokeWidth={2.5} aria-hidden="true" />
              Sourcing
            </span>
          )}
          {summary.reference && !isSourcing && (
            <span className="flex-none rounded border border-[#ADB8B9] bg-transparent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#64748b]">
              {summary.reference}
            </span>
          )}
          {persoBadge === "sans-perso" && (
            <span
              className="inline-flex flex-none items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "rgba(100, 116, 139, 0.10)",
                color: "#64748b",
              }}
            >
              Sans perso
            </span>
          )}
          {persoBadge === "to-personalize" && (
            <span className="inline-flex flex-none items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-800">
              <Sparkles size={9} aria-hidden="true" strokeWidth={2.2} />
              À personnaliser
            </span>
          )}
          {persoBadge === "to-decide" && (
            <span className="inline-flex flex-none items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
              À décider
            </span>
          )}
        </div>
        {summary.colors && summary.colors.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {summary.colors.map((color) => (
              <div
                key={color.id}
                className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1"
              >
                <div
                  className="h-3 w-3 flex-none rounded-full border border-slate-300 shadow-sm"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-medium text-slate-700">
                  {color.label}
                </span>
                <span className="text-[11px] text-slate-400">×{color.qty}</span>
              </div>
            ))}
            {summary.declensions && (
              <span className="text-[11px] font-medium text-slate-500">
                {summary.declensions}
              </span>
            )}
          </div>
        ) : summary.declensions ? (
          <p className="mt-0.5 truncate text-[12px] text-slate-500">
            {summary.declensions}
          </p>
        ) : null}
      </div>

      {!expanded && (
        <div className="flex flex-none flex-col items-end">
          <span className="text-[11px] text-slate-400">
            {totals.totalQty} {totals.totalQty > 1 ? "unités" : "unité"}
          </span>
          {isSourcing && totals.subtotal === 0 ? (
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-amber-700"
              title="Sera renseigné par un manager après sourcing"
            >
              À chiffrer
            </span>
          ) : (
            <NumberRoller
              value={formatEUR(totals.subtotal)}
              fontSize={14}
              className="font-mono text-[14px] font-bold tabular-nums text-slate-800"
            />
          )}
        </div>
      )}

      <div
        className="flex flex-none items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
        data-action="menu"
      >
        {!isEmpty && (
          <ActionButton
            label="Modifier la ligne"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={14} />
          </ActionButton>
        )}
        {!isEmpty && onCopyArtwork && (
          <ActionButton
            label="Copier le visuel sur d'autres lignes"
            onClick={(e) => {
              e.stopPropagation();
              onCopyArtwork();
            }}
          >
            <Copy size={14} />
          </ActionButton>
        )}
        {!isEmpty && (
          <ActionButton
            label="Dupliquer"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy size={14} className="rotate-180" />
          </ActionButton>
        )}
        {confirmDelete ? (
          <button
            type="button"
            data-action="delete-confirm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setConfirmDelete(false);
            }}
            className="flex h-7 items-center gap-1 rounded-md bg-rose-600 px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            <Trash2 size={12} />
            Confirmer
          </button>
        ) : (
          <ActionButton
            label="Supprimer"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
              window.setTimeout(() => setConfirmDelete(false), 4000);
            }}
            tone="danger"
          >
            <Trash2 size={14} />
          </ActionButton>
        )}
      </div>

      {showChevron && (
        <span
          aria-hidden="true"
          className={`flex flex-none items-center justify-center text-slate-400 transition-transform duration-300 ease-in-out ${
            expanded ? "rotate-180 text-slate-700" : "rotate-0 group-hover:text-slate-600"
          }`}
        >
          <ChevronDown size={16} />
        </span>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}

function ActionButton({ label, onClick, children, tone = "neutral" }: ActionButtonProps) {
  const toneClass =
    tone === "danger"
      ? "text-rose-500 hover:bg-rose-50 hover:text-rose-700"
      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700";
  return (
    <button
      type="button"
      data-action="quick"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${toneClass}`}
    >
      {children}
    </button>
  );
}

interface ColorDetail {
  hex: string;
  label: string;
  qty: number;
  id: string;
}

interface LineSummary {
  title: string;
  reference: string | null;
  declensions: string;
  thumbnailHex: string | null;
  productTarget: ProductTarget | null;
  colors?: ColorDetail[];
}

const MAX_VISIBLE_DECLENSIONS = 3;

/** Pure function — easy to unit-test. */
export function describeLine(line: OrderLine): LineSummary {
  if (isClassicLine(line)) {
    const produit = line.customProduit?.trim() || line.produit || "Sans nom";
    const declensions =
      line.quantity > 0 ? `${line.quantity} unité${line.quantity > 1 ? "s" : ""}` : "—";
    return {
      title: produit,
      reference: line.secteur,
      declensions,
      thumbnailHex: null,
      productTarget: null,
    };
  }
  if (isTextileLine(line)) {
    const model = getTextileModel(line.modelId);
    const title = line.modelName || model?.name || "";
    const reference = model?.reference ?? null;
    const productTarget = (model?.target as ProductTarget) ?? null;

    const items = Object.values(line.items).filter((it) => it.qty > 0);
    if (items.length === 0) {
      return { title, reference, declensions: "", thumbnailHex: null, productTarget, colors: [] };
    }

    // Group by color, keep insertion order. Also build color details for swatches.
    const byColor = new Map<string, number>();
    const colorDetails = new Map<string, ColorDetail>();

    for (const it of items) {
      const k = it.isPlaceholder ? "—" : it.color;
      byColor.set(k, (byColor.get(k) ?? 0) + it.qty);

      // Build color details for rendering swatches
      if (!it.isPlaceholder) {
        const colorInfo = model?.colors.find((c) => c.id === it.color);
        if (colorInfo) {
          if (!colorDetails.has(it.color)) {
            colorDetails.set(it.color, {
              id: it.color,
              hex: colorInfo.hex,
              label: colorInfo.label,
              qty: 0,
            });
          }
          // Update qty as we accumulate items
          const detail = colorDetails.get(it.color)!;
          detail.qty += it.qty;
        }
      }
    }

    const entries = [...byColor.entries()];
    const visible = entries.slice(0, MAX_VISIBLE_DECLENSIONS);
    const remaining = entries.length - visible.length;

    const firstColor = items.find((it) => !it.isPlaceholder)?.color ?? null;
    const thumbnailHex =
      (firstColor && model?.colors.find((c) => c.id === firstColor)?.hex) || null;

    // Return colors array for visual display (limited to visible)
    const colorsArray = [...colorDetails.values()].slice(0, MAX_VISIBLE_DECLENSIONS);

    return {
      title,
      reference,
      declensions: remaining > 0 ? `+${remaining}` : "",
      thumbnailHex,
      productTarget,
      colors: colorsArray,
    };
  }
  return { title: "Ligne", reference: null, declensions: "—", thumbnailHex: null, productTarget: null };
}

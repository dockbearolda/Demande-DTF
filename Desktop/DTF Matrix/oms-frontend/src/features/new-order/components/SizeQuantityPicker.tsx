import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { computeTotals, formatEUR } from "../pricing";
import { selectLine, useNewOrderStore } from "../store";
import {
  isTextileLine,
  type LineTotals,
  type TextileLine,
  type TextileSize,
} from "../types";
import { TEXTILE_MODELS } from "../constants";

interface Props {
  /** Colors currently toggled on (swatch rail controls this). */
  activeColors: Set<string>;
  onAddColor?: (colorId: string) => void;
  onRemoveColor?: (colorId: string) => void;
}

/**
 * SizeQuantityPicker — grille couleurs × tailles
 *
 * Remplace les accordéons "ajouter une taille" par une matrice unifiée :
 *   lignes = couleurs sélectionnées, colonnes = tailles du modèle.
 * Chaque cellule est un <input> numérique avec navigation clavier.
 */
export const SizeQuantityPicker = memo(function SizeQuantityPicker({
  activeColors,
  onRemoveColor,
}: Props) {
  const line = useNewOrderStore(selectLine);
  if (!line || !isTextileLine(line)) return null;
  return <Inner line={line} activeColors={activeColors} onRemoveColor={onRemoveColor} />;
});

// ─────────────────────────────────────────────────────────────
// Inner — the actual grid
// ─────────────────────────────────────────────────────────────

function Inner({
  line,
  activeColors,
  onRemoveColor,
}: {
  line: TextileLine;
  activeColors: Set<string>;
  onRemoveColor?: (colorId: string) => void;
}) {
  const upsert = useNewOrderStore((s) => s.upsertTextileItem);

  const model = useMemo(
    () => TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null,
    [line.modelId],
  );

  const sortedSizes = useMemo<TextileSize[]>(
    () => (model ? [...model.sizes].sort((a, b) => a.order - b.order) : []),
    [model],
  );

  const colorsOrdered = useMemo(
    () => (model ? model.colors.filter((c) => activeColors.has(c.id)) : []),
    [model, activeColors],
  );

  // ── Ref grid [row][col] for keyboard navigation ──
  const refs = useRef<(HTMLInputElement | null)[][]>([]);

  // Auto-focus first cell when a new color row appears
  const prevColorIds = useRef<string[]>([]);
  useEffect(() => {
    const curr = colorsOrdered.map((c) => c.id);
    const prev = prevColorIds.current;
    if (curr.length > prev.length) {
      const newId = curr.find((id) => !prev.includes(id));
      if (newId !== undefined) {
        const ri = curr.indexOf(newId);
        requestAnimationFrame(() => refs.current[ri]?.[0]?.focus());
      }
    }
    prevColorIds.current = curr;
  }, [colorsOrdered]);

  // ── Qty helpers — deterministic item ID: colorId__sizeId ──

  const getQty = useCallback(
    (colorId: string, sizeId: string): number =>
      line.items[`${colorId}__${sizeId}`]?.qty ?? 0,
    [line.items],
  );

  const setQty = useCallback(
    (colorId: string, sizeId: string, rawQty: number) => {
      upsert({
        id: `${colorId}__${sizeId}`,
        color: colorId,
        size: sizeId,
        qty: Math.max(0, rawQty || 0),
      });
    },
    [upsert],
  );

  // ── Keyboard navigation ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, ri: number, ci: number) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Same column, next row
        if (ri + 1 < colorsOrdered.length) {
          refs.current[ri + 1]?.[ci]?.focus();
        }
      }
    },
    [colorsOrdered.length],
  );

  // ── Double-click stepped increment (via mousedown detail to bypass browser text-selection) ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLInputElement>, colorId: string, sizeId: string) => {
      if (e.detail === 2) {
        e.preventDefault(); // prevent browser text-selection on 2nd click
        const current = getQty(colorId, sizeId);
        const step = current < 15 ? 1 : 5;
        setQty(colorId, sizeId, current + step);
      }
    },
    [getQty, setQty],
  );

  // ── Remove color with confirmation when qty > 0 ──

  const handleRemoveColor = useCallback(
    (colorId: string, colorLabel: string) => {
      const total = sortedSizes.reduce((s, sz) => s + getQty(colorId, sz.id), 0);
      if (
        total > 0 &&
        !window.confirm(
          `Retirer « ${colorLabel} » et effacer les ${total} pièce${total > 1 ? "s" : ""} ?`,
        )
      ) {
        return;
      }
      onRemoveColor?.(colorId);
    },
    [sortedSizes, getQty, onRemoveColor],
  );

  // ── Derived totals ──

  const rowTotals = useMemo(
    () => colorsOrdered.map((c) => sortedSizes.reduce((s, sz) => s + getQty(c.id, sz.id), 0)),
    // line.items changes trigger this via getQty
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [line.items, colorsOrdered, sortedSizes],
  );

  const colTotals = useMemo(
    () => sortedSizes.map((sz) => colorsOrdered.reduce((s, c) => s + getQty(c.id, sz.id), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [line.items, colorsOrdered, sortedSizes],
  );

  const grandTotal = colTotals.reduce((s, v) => s + v, 0);

  const priceTotals = useMemo(() => computeTotals(line), [line]);

  if (!model) return null;

  if (colorsOrdered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-400">
        Sélectionne d'abord une couleur ci-dessus
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <table className="w-full border-collapse table-fixed">
          {/* ── Header ── */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                scope="col"
                className="w-32 py-2 pl-3 pr-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Couleur
              </th>
              {sortedSizes.map((sz) => (
                <th
                  key={sz.id}
                  scope="col"
                  className="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500"
                >
                  {sz.label}
                </th>
              ))}
              <th
                scope="col"
                className="w-12 px-2 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Total
              </th>
              <th scope="col" className="w-9" aria-label="Actions" />
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {colorsOrdered.map((color, ri) => {
              if (!refs.current[ri]) refs.current[ri] = [];
              const rowTotal = rowTotals[ri] ?? 0;

              return (
                <tr key={color.id} className="border-b border-slate-100 last:border-b-0">
                  {/* Color label + swatch */}
                  <td className="py-2 pl-3 pr-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`block h-5 w-5 flex-none rounded-full ${
                          color.swatchBorder ? "ring-1 ring-slate-300" : ""
                        }`}
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {color.label}
                      </span>
                    </div>
                  </td>

                  {/* Qty cells */}
                  {sortedSizes.map((sz, ci) => {
                    const qty = getQty(color.id, sz.id);
                    const hasValue = qty > 0;
                    return (
                      <td key={sz.id} className="px-1 py-1.5">
                        <input
                          ref={(el) => {
                            refs.current[ri][ci] = el;
                          }}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={hasValue ? qty : ""}
                          placeholder="—"
                          aria-label={`${color.label} · taille ${sz.label}`}
                          onChange={(e) =>
                            setQty(color.id, sz.id, Number(e.target.value) || 0)
                          }
                          onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                          onMouseDown={(e) => handleMouseDown(e, color.id, sz.id)}
                          className={[
                            "qty-cell-input block h-9 w-full rounded-md border text-center text-xs tabular-nums transition",
                            "focus:outline-none focus-visible:outline focus-visible:outline-2",
                            "focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600",
                            hasValue
                              ? "border-blue-600 bg-[#EFF6FF] font-bold text-blue-700"
                              : "border-[#e5e2dc] bg-[#fafaf9] text-slate-300 placeholder:text-slate-300",
                          ].join(" ")}
                        />
                      </td>
                    );
                  })}

                  {/* Row subtotal */}
                  <td className="px-2 py-2 text-right">
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${
                        rowTotal > 0 ? "text-slate-900" : "text-slate-300"
                      }`}
                      aria-label={`Sous-total ${color.label} : ${rowTotal}`}
                    >
                      {rowTotal > 0 ? rowTotal : "—"}
                    </span>
                  </td>

                  {/* Remove color */}
                  <td className="py-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color.id, color.label)}
                      aria-label={`Retirer la couleur ${color.label}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <XIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── Footer: column totals ── */}
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="py-2 pl-3 pr-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total
              </td>
              {colTotals.map((total, i) => (
                <td key={i} className="px-1 py-2 text-center">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      total > 0 ? "text-slate-900" : "text-slate-300"
                    }`}
                  >
                    {total > 0 ? total : "—"}
                  </span>
                </td>
              ))}
              {/* Grand total (bottom-right corner) */}
              <td className="px-3 py-2 text-right">
                <span className="font-mono text-base font-extrabold tabular-nums text-slate-900">
                  {grandTotal > 0 ? grandTotal : "—"}
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Grand total pill */}
      <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-3 text-white">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
          Total commande
        </span>
        <span className="font-mono text-lg font-extrabold tabular-nums">
          {grandTotal}{" "}
          <span className="text-xs font-medium text-slate-300">pcs</span>
        </span>
      </div>

      {/* Price bar */}
      {grandTotal > 0 && <PriceBar totals={priceTotals} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PriceBar
// ─────────────────────────────────────────────────────────────

function PriceBar({ totals }: { totals: LineTotals }) {
  const { totalQty, unitPrice, subtotal, nextTier, unitsToNextTier } = totals;
  if (totalQty === 0 || unitPrice === 0) return null;

  // Savings = (currentUnitPrice − nextTierUnitPrice) × currentQty
  const savings =
    unitsToNextTier !== null && nextTier
      ? (unitPrice - nextTier.unitPrice) * totalQty
      : null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-blue-900">{formatEUR(subtotal)}</span>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[12px] font-bold text-blue-700">
          {formatEUR(unitPrice)} / pcs
        </span>
      </div>
      {unitsToNextTier !== null && nextTier && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-blue-700">
          Ajoutez{" "}
          <span className="font-bold">{unitsToNextTier} pcs</span>
          {" → "}
          {formatEUR(nextTier.unitPrice)}/u
          {savings !== null && savings > 0 && (
            <>
              {" · "}Économie :{" "}
              <span className="font-bold">{formatEUR(savings)}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Icon
// ─────────────────────────────────────────────────────────────

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

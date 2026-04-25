import { memo, useMemo } from "react";
import { selectLine, useNewOrderStore } from "../store";
import {
  isTextileLine,
  type TextileColor,
  type TextileItem,
  type TextileLine,
  type TextileSize,
} from "../types";
import { TEXTILE_MODELS } from "../constants";

interface Props {
  /** Restrict the picker to specific colors (typically the user-toggled set). */
  activeColors: Set<string>;
  /** Optional callback fired when user opts to add a color via the chip rail. */
  onAddColor?: (colorId: string) => void;
  /** Optional callback fired when a color section is fully removed. */
  onRemoveColor?: (colorId: string) => void;
}

/**
 * SizeQuantityPicker
 * ------------------------------------------------------------
 * Row-based picker. Each color has its own list of [size ▾] [qty -/+] [🗑] rows
 * and an "+ Ajouter une taille" button. Total updates live and is shown at the
 * bottom of the picker.
 *
 * Replaces the dense N×M color × size matrix with a more progressive flow.
 */
export const SizeQuantityPicker = memo(function SizeQuantityPicker({
  activeColors,
  onRemoveColor,
}: Props) {
  const line = useNewOrderStore(selectLine);
  if (!line || !isTextileLine(line)) return null;
  return <Inner line={line} activeColors={activeColors} onRemoveColor={onRemoveColor} />;
});

function Inner({
  line,
  activeColors,
  onRemoveColor,
}: {
  line: TextileLine;
  activeColors: Set<string>;
  onRemoveColor?: (colorId: string) => void;
}) {
  const addRow = useNewOrderStore((s) => s.addTextileRowForColor);
  const patch = useNewOrderStore((s) => s.patchTextileItem);
  const remove = useNewOrderStore((s) => s.removeTextileItem);

  const model = useMemo(
    () => TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null,
    [line.modelId],
  );

  const sortedSizes = useMemo<TextileSize[]>(
    () => (model ? [...model.sizes].sort((a, b) => a.order - b.order) : []),
    [model],
  );

  const itemsByColor = useMemo(() => {
    const map = new Map<string, TextileItem[]>();
    for (const it of Object.values(line.items)) {
      if (it.isPlaceholder) continue;
      const arr = map.get(it.color) ?? [];
      arr.push(it);
      map.set(it.color, arr);
    }
    return map;
  }, [line.items]);

  const grandTotal = useMemo(() => {
    let t = 0;
    for (const it of Object.values(line.items)) {
      if (!it.isPlaceholder) t += it.qty || 0;
    }
    return t;
  }, [line.items]);

  if (!model) return null;

  const colorsOrdered = model.colors.filter((c) => activeColors.has(c.id));
  if (colorsOrdered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-400">
        Sélectionne d'abord une couleur ci-dessus
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {colorsOrdered.map((color) => {
        const rows = itemsByColor.get(color.id) ?? [];
        const total = rows.reduce((s, it) => s + (it.qty || 0), 0);
        return (
          <ColorSection
            key={color.id}
            color={color}
            sizes={sortedSizes}
            rows={rows}
            total={total}
            onAdd={() => addRow(color.id)}
            onPatch={(id, p) => patch(id, p)}
            onRemoveRow={(id) => remove(id)}
            onRemoveColor={() => onRemoveColor?.(color.id)}
          />
        );
      })}

      <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-3 text-white">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
          Total commande
        </span>
        <span className="font-mono text-lg font-extrabold tabular-nums">
          {grandTotal} <span className="text-xs font-medium text-slate-300">pcs</span>
        </span>
      </div>
    </div>
  );
}

// ───────── ColorSection ─────────

function ColorSection({
  color,
  sizes,
  rows,
  total,
  onAdd,
  onPatch,
  onRemoveRow,
  onRemoveColor,
}: {
  color: TextileColor;
  sizes: TextileSize[];
  rows: TextileItem[];
  total: number;
  onAdd: () => void;
  onPatch: (id: string, p: Partial<Omit<TextileItem, "id">>) => void;
  onRemoveRow: (id: string) => void;
  onRemoveColor?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`block h-6 w-6 flex-none rounded-full ${
              color.swatchBorder ? "ring-1 ring-slate-300" : ""
            }`}
            style={{ backgroundColor: color.hex }}
          />
          <span className="truncate text-sm font-semibold text-slate-900">
            {color.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Sous-total
          </span>
          <span
            className="font-mono text-sm font-bold tabular-nums text-slate-900"
            aria-label={`Sous-total ${color.label} : ${total}`}
          >
            {total}
          </span>
          {onRemoveColor && (
            <button
              type="button"
              onClick={onRemoveColor}
              aria-label={`Retirer la couleur ${color.label}`}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.length === 0 && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
            Aucune taille — ajoute une ligne ci-dessous
          </p>
        )}
        {rows.map((row) => (
          <SizeQtyRow
            key={row.id}
            row={row}
            sizes={sizes}
            colorLabel={color.label}
            onPatch={(p) => onPatch(row.id, p)}
            onRemove={() => onRemoveRow(row.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        aria-label={`Ajouter une taille pour ${color.label}`}
        className="mt-3 inline-flex h-11 min-w-[44px] items-center gap-1.5 rounded-lg border border-dashed border-slate-400 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        Ajouter une taille
      </button>
    </div>
  );
}

// ───────── SizeQtyRow ─────────

function SizeQtyRow({
  row,
  sizes,
  colorLabel,
  onPatch,
  onRemove,
}: {
  row: TextileItem;
  sizes: TextileSize[];
  colorLabel: string;
  onPatch: (p: Partial<Omit<TextileItem, "id">>) => void;
  onRemove: () => void;
}) {
  const dec = () => onPatch({ qty: Math.max(0, (row.qty || 0) - 1) });
  const inc = () => onPatch({ qty: (row.qty || 0) + 1 });
  const sizeLabel = sizes.find((s) => s.id === row.size)?.label ?? row.size;
  const targetLabel = `${colorLabel} · taille ${sizeLabel}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
      {/* Size dropdown — 44px height for tap target & 16px font */}
      <div className="relative flex-1 min-w-0 max-w-[160px]">
        <select
          value={row.size}
          aria-label={`Taille pour ${colorLabel}`}
          onChange={(e) => onPatch({ size: e.target.value })}
          className="block h-11 w-full appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-base font-medium text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {sizes.map((sz) => (
            <option key={sz.id} value={sz.id}>
              Taille {sz.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
      </div>

      {/* Quantity stepper — 44×44 buttons */}
      <div
        className={`inline-flex items-stretch overflow-hidden rounded-md border bg-white ${
          row.qty > 0 ? "border-blue-700" : "border-slate-300"
        }`}
      >
        <button
          type="button"
          onClick={dec}
          aria-label={`Diminuer la quantité — ${targetLabel}`}
          disabled={row.qty <= 0}
          className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <MinusIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={row.qty || ""}
          aria-label={`Quantité — ${targetLabel}`}
          onChange={(e) =>
            onPatch({ qty: Math.max(0, Number(e.target.value) || 0) })
          }
          placeholder="0"
          className={`h-11 w-14 border-l border-r border-slate-300 bg-transparent text-center text-base tabular-nums focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 ${
            row.qty > 0 ? "font-bold text-blue-800" : "font-semibold text-slate-800"
          }`}
        />
        <button
          type="button"
          onClick={inc}
          aria-label={`Augmenter la quantité — ${targetLabel}`}
          className="flex h-11 w-11 items-center justify-center text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Trash — 44×44 */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Supprimer la ligne — ${targetLabel}`}
        className="ml-auto flex h-11 w-11 flex-none items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <TrashIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ───────── Icons ─────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

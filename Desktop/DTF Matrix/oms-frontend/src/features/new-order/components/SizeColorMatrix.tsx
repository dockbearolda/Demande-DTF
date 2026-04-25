import { memo, useMemo } from "react";
import { useNewOrderStore } from "../store";
import type { TextileColor, TextileItem, TextileSize } from "../types";
import { QtyCell } from "./primitives";

interface Props {
  sizes: TextileSize[];
  colors: TextileColor[];
  items: Record<string, TextileItem>;
}

/**
 * Grille tailles × couleurs optimisée :
 * - 1 cellule update = 1 cell re-render (grâce à <Row memo et items as Record).
 * - IDs stables "<color>-<size>" => pas de remount d'input quand on tape.
 */
export const SizeColorMatrix = memo(function SizeColorMatrix({
  sizes,
  colors,
  items,
}: Props) {
  const upsert = useNewOrderStore((s) => s.upsertTextileItem);

  const sortedSizes = useMemo(
    () => [...sizes].sort((a, b) => a.order - b.order),
    [sizes],
  );

  // Map (color, size) -> qty
  const qtyFor = (colorId: string, sizeId: string) => {
    const id = `${colorId}-${sizeId}`;
    return items[id]?.qty ?? 0;
  };

  const onChange = (color: TextileColor, size: TextileSize, qty: number) => {
    const id = `${color.id}-${size.id}`;
    upsert({ id, size: size.id, color: color.id, qty });
  };

  const totalBySize = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of Object.values(items)) {
      if (it.isPlaceholder) continue;
      m.set(it.size, (m.get(it.size) ?? 0) + it.qty);
    }
    return m;
  }, [items]);

  const totalByColor = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of Object.values(items)) {
      if (it.isPlaceholder) continue;
      m.set(it.color, (m.get(it.color) ?? 0) + it.qty);
    }
    return m;
  }, [items]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Couleur
            </th>
            {sortedSizes.map((sz) => (
              <th
                key={sz.id}
                className="px-2 py-2 text-center text-[11px] font-semibold text-slate-600"
              >
                {sz.label}
              </th>
            ))}
            <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Σ
            </th>
          </tr>
        </thead>
        <tbody>
          {colors.map((col) => (
            <Row
              key={col.id}
              color={col}
              sizes={sortedSizes}
              getQty={qtyFor}
              onChange={onChange}
              rowTotal={totalByColor.get(col.id) ?? 0}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total
            </td>
            {sortedSizes.map((sz) => (
              <td
                key={sz.id}
                className="px-2 py-2 text-center text-xs font-semibold tabular-nums text-slate-700"
              >
                {totalBySize.get(sz.id) ?? 0}
              </td>
            ))}
            <td className="px-2 py-2 text-center text-xs font-bold tabular-nums text-slate-800">
              {[...totalBySize.values()].reduce((a, b) => a + b, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
});

interface RowProps {
  color: TextileColor;
  sizes: TextileSize[];
  getQty: (colorId: string, sizeId: string) => number;
  onChange: (c: TextileColor, s: TextileSize, qty: number) => void;
  rowTotal: number;
}

const Row = memo(function Row({ color, sizes, getQty, onChange, rowTotal }: RowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-5 w-5 flex-none rounded-full ${
              color.swatchBorder ? "ring-1 ring-slate-200" : ""
            }`}
            style={{ backgroundColor: color.hex }}
          />
          <span className="text-xs font-medium text-slate-700">{color.label}</span>
        </div>
      </td>
      {sizes.map((sz) => (
        <td key={sz.id} className="p-1">
          <QtyCell
            value={getQty(color.id, sz.id)}
            onChange={(q) => onChange(color, sz, q)}
            compact
          />
        </td>
      ))}
      <td className="px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-600">
        {rowTotal || ""}
      </td>
    </tr>
  );
});

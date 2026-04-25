import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNewOrderStore } from "../store";
import type { TextileColor, TextileItem, TextileSize } from "../types";
import { HybridQtyInput } from "./HybridQtyInput";

interface Props {
  sizes: TextileSize[];
  colors: TextileColor[];
  items: Record<string, TextileItem>;
}

/**
 * Tableau dynamique ligne-par-ligne : [Couleur] [Taille] [Qté hybride] [Supprimer].
 * Remplace la grille couleur×taille — plus adapté au "devis rapide".
 */
export const SizeColorTable = memo(function SizeColorTable({
  sizes,
  colors,
  items,
}: Props) {
  const patch = useNewOrderStore((s) => s.patchTextileItem);
  const remove = useNewOrderStore((s) => s.removeTextileItem);
  const addRow = useNewOrderStore((s) => s.addTextileRow);

  const sortedSizes = useMemo(
    () => [...sizes].sort((a, b) => a.order - b.order),
    [sizes],
  );

  // Pas de placeholder dans la table
  const rows = useMemo(
    () =>
      Object.values(items)
        .filter((it) => !it.isPlaceholder)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [items],
  );

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (r.qty || 0), 0),
    [rows],
  );

  const handleAdd = () => {
    addRow();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="grid grid-cols-[1.2fr_0.9fr_1fr_40px] items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Couleur
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Taille
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Quantité
        </div>
        <div />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-400">Aucune ligne — commencez par ajouter une taille/couleur.</p>
          </div>
        )}
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            colors={colors}
            sizes={sortedSizes}
            onPatch={(p) => patch(row.id, p)}
            onRemove={() => remove(row.id)}
          />
        ))}
      </div>

      {/* Footer + Add */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
        <button
          type="button"
          onClick={handleAdd}
          className="group inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-slate-500 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
        >
          <PlusIcon className="h-4 w-4 text-slate-500 transition group-hover:text-slate-800" />
          Ajouter une taille/couleur
        </button>

        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total
          </span>
          <span className="font-mono text-base font-bold tabular-nums text-slate-800">
            {total}
          </span>
          <span className="text-xs text-slate-500">pièces</span>
        </div>
      </div>
    </div>
  );
});

// ───────── Row ─────────

interface RowProps {
  row: TextileItem;
  colors: TextileColor[];
  sizes: TextileSize[];
  onPatch: (patch: Partial<Omit<TextileItem, "id">>) => void;
  onRemove: () => void;
}

const Row = memo(function Row({ row, colors, sizes, onPatch, onRemove }: RowProps) {
  return (
    <div className="grid grid-cols-[1.2fr_0.9fr_1fr_40px] items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50/60">
      <ColorSelect value={row.color} options={colors} onChange={(v) => onPatch({ color: v })} />
      <SizeSelect value={row.size} options={sizes} onChange={(v) => onPatch({ size: v })} />
      <HybridQtyInput value={row.qty} onChange={(q) => onPatch({ qty: q })} />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Supprimer la ligne"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
});

// ───────── ColorSelect ─────────

function ColorSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: TextileColor[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((c) => c.id === value) ?? options[0];

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm transition ${
          open
            ? "border-slate-400 ring-2 ring-slate-100"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Swatch color={current} size={20} />
          <span className="truncate font-medium text-slate-800">{current?.label ?? "—"}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[280px] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="grid grid-cols-4 gap-1.5">
            {options.map((c) => {
              const active = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  aria-label={c.label}
                  title={c.label}
                  className={`group flex flex-col items-center gap-1 rounded-lg p-2 transition ${
                    active ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`relative h-7 w-7 flex-none rounded-full transition ${
                      c.swatchBorder ? "ring-1 ring-slate-200" : ""
                    } ${active ? "ring-2 ring-slate-800 ring-offset-2" : ""}`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <CheckIcon
                          className={`h-4 w-4 ${c.id === "white" ? "text-slate-800" : "text-white"}`}
                        />
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[10px] font-medium text-slate-600 group-hover:text-slate-800">
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Swatch({ color, size = 18 }: { color?: TextileColor; size?: number }) {
  if (!color) return null;
  return (
    <span
      className={`block flex-none rounded-full ${color.swatchBorder ? "ring-1 ring-slate-200" : ""}`}
      style={{ backgroundColor: color.hex, width: size, height: size }}
    />
  );
}

// ───────── SizeSelect ─────────

function SizeSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: TextileSize[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold tabular-nums text-slate-800 transition hover:border-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
      >
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
        <Chevron open={false} />
      </span>
    </div>
  );
}

// ───────── Icons ─────────

function PlusIcon({ className }: { className?: string }) {
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
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
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Order } from "@/lib/types";
import {
  COLUMN_DEFS,
  type ColumnId,
  type Density,
  type SortKey,
  type SortRule,
} from "../types";
import { buildChildRows, type ChildRow } from "../state/expandRow";
import type { ListSummary } from "../state/filterOrders";
import { OrderRowParent } from "./OrderRowParent";
import { OrderRowChild } from "./OrderRowChild";

const COLUMN_SORT_KEY: Partial<Record<ColumnId, SortKey>> = {
  reference: "reference",
  client: "client",
  statut: "statut",
  secteur: "secteur",
  livraison: "livraison",
  montant: "montant",
  date_creation: "date_creation",
};

const FORMAT_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

interface Props {
  orders: Order[]; // déjà filtrés + triés
  visibleColumns: ColumnId[];
  density: Density;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent, idx: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  sortRules: SortRule[];
  onSortChange: (rules: SortRule[]) => void;
  onOpenOrder: (id: string) => void;
  /** Résumé live pour le footer fixe. */
  footerSummary: ListSummary;
}

type RowItem =
  | { kind: "parent"; order: Order }
  | { kind: "child"; row: ChildRow };

const PARENT_COMPACT = 36;
const PARENT_COMFORT = 56;
const CHILD_HEIGHT = 28;

export function OrderListTable({
  orders,
  visibleColumns,
  density,
  expanded,
  onToggleExpand,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  sortRules,
  onSortChange,
  onOpenOrder,
  footerSummary,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);

  const rowH = density === "compact" ? PARENT_COMPACT : PARENT_COMFORT;

  // Aplatissement parent + enfants dépliés
  const items: RowItem[] = useMemo(() => {
    const out: RowItem[] = [];
    for (const o of orders) {
      out.push({ kind: "parent", order: o });
      if (expanded.has(o.id)) {
        for (const c of buildChildRows(o)) out.push({ kind: "child", row: c });
      }
    }
    return out;
  }, [orders, expanded]);

  // Index parent → position dans `items` (focus clavier).
  const parentIndices = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it, i) => {
      if (it.kind === "parent") map.set(it.order.id, i);
    });
    return map;
  }, [items]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: useCallback(
      (i: number) => (items[i]?.kind === "child" ? CHILD_HEIGHT : rowH),
      [items, rowH],
    ),
    overscan: 8,
  });

  // Recalcul des tailles quand la densité change (le rowH diffère).
  useEffect(() => {
    virtualizer.measure();
  }, [density, virtualizer]);

  // Grid template — partagé header + ligne parent.
  const gridTemplate = useMemo(() => {
    const cols = ["32px", "24px"];
    for (const id of visibleColumns) {
      const def = COLUMN_DEFS.find((c) => c.id === id);
      if (!def) continue;
      cols.push(def.width === "flex" ? "minmax(180px, 2fr)" : `${def.width}px`);
    }
    return cols.join(" ");
  }, [visibleColumns]);

  const minWidth = useMemo(() => {
    let w = 32 + 24;
    for (const id of visibleColumns) {
      const def = COLUMN_DEFS.find((c) => c.id === id);
      if (!def) continue;
      w += def.width === "flex" ? 220 : def.width;
    }
    return w;
  }, [visibleColumns]);

  const allSelected =
    orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someSelected = !allSelected && orders.some((o) => selectedIds.has(o.id));

  function handleSort(key: SortKey, shift: boolean) {
    if (!shift) {
      const single = sortRules.length === 1 && sortRules[0].key === key ? sortRules[0] : null;
      if (!single) {
        onSortChange([{ key, dir: "asc" }]);
        return;
      }
      if (single.dir === "asc") {
        onSortChange([{ key, dir: "desc" }]);
        return;
      }
      onSortChange([]);
      return;
    }
    // Multi-rule via Shift
    const existing = sortRules.find((r) => r.key === key);
    if (!existing) {
      onSortChange([...sortRules, { key, dir: "asc" }]);
      return;
    }
    if (existing.dir === "asc") {
      onSortChange(
        sortRules.map((r) => (r.key === key ? { ...r, dir: "desc" as const } : r)),
      );
      return;
    }
    onSortChange(sortRules.filter((r) => r.key !== key));
  }

  // Navigation clavier (flèches haut/bas) sur les lignes parent.
  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let next = focusIdx;
      // Saute les enfants — focus uniquement sur les parents.
      do {
        next += dir;
        if (next < 0 || next >= items.length) {
          next = focusIdx;
          break;
        }
      } while (items[next].kind !== "parent");
      setFocusIdx(next);
      virtualizer.scrollToIndex(next, { align: "auto" });
    },
    [focusIdx, items, virtualizer],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        background: "white",
        border: "1px solid var(--brand-sage-100)",
        borderRadius: 12,
        boxShadow: "var(--shadow-1)",
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollRef}
        onKeyDown={onListKeyDown}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          role="row"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: gridTemplate,
            minWidth,
            height: 38,
            background: "#F5F6F7",
            borderBottom: "1px solid rgba(74,98,116,0.12)",
          }}
        >
          {/* Checkbox de masse */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            <IndeterminateCheckbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() =>
                allSelected || someSelected ? onClearSelection() : onSelectAll()
              }
              ariaLabel={
                allSelected || someSelected ? "Tout désélectionner" : "Tout sélectionner"
              }
            />
          </div>
          <div /> {/* expand col */}
          {visibleColumns.map((col) => {
            const def = COLUMN_DEFS.find((c) => c.id === col);
            if (!def) return null;
            const sortKey = COLUMN_SORT_KEY[col];
            const sortIdx = sortKey
              ? sortRules.findIndex((r) => r.key === sortKey)
              : -1;
            const sortRule = sortIdx >= 0 ? sortRules[sortIdx] : null;
            return (
              <div
                key={col}
                role="columnheader"
                aria-sort={
                  sortRule ? (sortRule.dir === "asc" ? "ascending" : "descending") : "none"
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: def.align === "right" ? "flex-end" : def.align === "center" ? "center" : "flex-start",
                  padding: "0 10px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: sortRule ? "var(--brand-duck-500)" : "var(--fg-3)",
                  cursor: sortKey ? "default" : "default",
                  userSelect: "none",
                }}
              >
                {sortKey ? (
                  <button
                    type="button"
                    onClick={(e) => handleSort(sortKey, e.shiftKey)}
                    title={
                      sortKey
                        ? "Clic = tri ; Shift+clic = tri secondaire"
                        : undefined
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      fontSize: "inherit",
                      fontWeight: "inherit",
                      letterSpacing: "inherit",
                      textTransform: "inherit",
                      padding: 0,
                    }}
                  >
                    <span>{def.label}</span>
                    <SortIndicator
                      rule={sortRule}
                      multi={sortRules.length > 1}
                      idx={sortIdx}
                    />
                  </button>
                ) : (
                  def.label
                )}
              </div>
            );
          })}
        </div>

        {/* Empty list (handled by parent via EmptyState component, but if we reach
            here with 0 items we render nothing — parent should swap to EmptyState) */}
        {items.length > 0 && (
          <div
            style={{
              position: "relative",
              height: virtualizer.getTotalSize(),
              minWidth,
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const item = items[vi.index];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={(el) => virtualizer.measureElement(el)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    minWidth,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {item.kind === "parent" ? (
                    <OrderRowParent
                      order={item.order}
                      density={density}
                      expanded={expanded.has(item.order.id)}
                      selected={selectedIds.has(item.order.id)}
                      visibleColumns={visibleColumns}
                      gridTemplate={gridTemplate}
                      onToggleExpand={() => onToggleExpand(item.order.id)}
                      onToggleSelect={(e) =>
                        onToggleSelect(
                          item.order.id,
                          e,
                          parentIndices.get(item.order.id) ?? 0,
                        )
                      }
                      onOpen={() => onOpenOrder(item.order.id)}
                      rowIndex={vi.index}
                      focusedIndex={focusIdx}
                      onFocusRow={setFocusIdx}
                    />
                  ) : (
                    <div style={{ height: CHILD_HEIGHT }}>
                      <OrderRowChild row={item.row} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer fixe */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderTop: "1px solid rgba(74,98,116,0.10)",
          background: "var(--brand-paper-hi)",
          fontSize: 12,
          color: "var(--fg-2)",
        }}
      >
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {footerSummary.count}
        </span>
        <span>commande{footerSummary.count > 1 ? "s" : ""} affichée{footerSummary.count > 1 ? "s" : ""}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {FORMAT_EUR.format(footerSummary.totalAmount)}
        </span>
        <span>TTC</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {footerSummary.totalItems}
        </span>
        <span>article{footerSummary.totalItems > 1 ? "s" : ""}</span>
        {selectedIds.size > 0 && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: "var(--brand-duck-500)", fontWeight: 600 }}>
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              style={{
                marginLeft: 4,
                background: "transparent",
                border: "none",
                color: "var(--fg-3)",
                fontSize: 11.5,
                fontWeight: 500,
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              effacer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ───────── Indicateur de tri ─────────

function SortIndicator({
  rule,
  multi,
  idx,
}: {
  rule: SortRule | null;
  multi: boolean;
  idx: number;
}) {
  if (!rule) {
    return (
      <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.45 }}>
        ↕
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 10,
        color: "var(--brand-duck-500)",
      }}
    >
      <span>{rule.dir === "asc" ? "▲" : "▼"}</span>
      {multi && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 13,
            height: 13,
            padding: "0 3px",
            borderRadius: 7,
            background: "var(--brand-duck-500)",
            color: "var(--fg-on-primary)",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {idx + 1}
        </span>
      )}
    </span>
  );
}

// ───────── Checkbox indéterminée ─────────

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      style={{ cursor: "pointer", accentColor: "var(--brand-duck-500)" }}
    />
  );
}

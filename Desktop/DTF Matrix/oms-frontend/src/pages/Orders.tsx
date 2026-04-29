import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OrderEditDrawer } from "@/components/OrderEditDrawer";
import { OrderDetailPanel } from "@/components/OrderDetailPanel";
import { useOrders } from "@/hooks/useOrders";
import { useClients } from "@/hooks/useClients";
import type { Order } from "@/lib/types";
import {
  EmptyState,
  FiltersBar,
  OrderListTable,
  OrdersToolbar,
  applyFilters,
  applyMultiSort,
  hasActiveFilters,
  summarize,
  useColumnVisibility,
  useDensity,
  useExpandedRows,
  useListFilters,
  useSavedViews,
  useSortRules,
  type SavedView,
} from "@/features/orders-list";
import { EMPTY_FILTERS } from "@/features/orders-list/types";
import { STATUS_LABELS, SECTEUR_LABELS } from "@/lib/types";

/**
 * Page Commandes — usage atelier interne haute fréquence.
 * Filtres URL-persisted, multi-tri, virtualisation, hiérarchie expand/collapse.
 */
export function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editingId = searchParams.get("edit");
  const detailId = searchParams.get("detail");

  // ───────── Préférences (localStorage) ─────────
  const [density, setDensity] = useDensity();
  const [columns, setColumns] = useColumnVisibility();
  const [sortRules, setSortRules] = useSortRules();
  const { expanded, toggle: toggleExpand, collapseAll } = useExpandedRows();

  // ───────── Filtres (URL + localStorage) ─────────
  const { filters, setFilters, patchFilters, reset } = useListFilters();

  // ───────── Vues sauvegardées ─────────
  const { views, saveView, deleteView } = useSavedViews();

  // Fetch large set; client-side filtering keeps interaction <100ms à 500 lignes.
  const { data: rawOrders = [], isLoading } = useOrders({ limit: 500 });
  const { data: clients = [] } = useClients();

  // ───────── Pipeline orders ─────────
  const filtered = useMemo(() => applyFilters(rawOrders, filters), [rawOrders, filters]);
  const sorted = useMemo(() => applyMultiSort(filtered, sortRules), [filtered, sortRules]);
  const summary = useMemo(() => summarize(filtered), [filtered]);

  // ───────── Sélection multi-row ─────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIdx = useRef<number>(-1);

  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent, idx: number) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastClickedIdx.current >= 0) {
          const lo = Math.min(lastClickedIdx.current, idx);
          const hi = Math.max(lastClickedIdx.current, idx);
          for (let i = lo; i <= hi; i++) {
            const o = sorted[i];
            if (o) next.add(o.id);
          }
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      lastClickedIdx.current = idx;
    },
    [sorted],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sorted.map((o) => o.id)));
  }, [sorted]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIdx.current = -1;
  }, []);

  // ───────── Drawer / Panel ─────────
  const setEditingId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("edit", id);
          else next.delete("edit");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setDetailId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("detail", id);
          else next.delete("detail");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Cache map keyed by id — feeds the detail panel so that ↑/↓ navigation is
  // instant from already-fetched data without waiting on /orders/{id}.
  const ordersById = useMemo(() => {
    const m = new Map<string, Order>();
    for (const o of rawOrders) m.set(o.id, o);
    return m;
  }, [rawOrders]);

  const navOrderIds = useMemo(() => sorted.map((o) => o.id), [sorted]);

  const onDuplicate = useCallback((o: Order) => {
    navigate(`/orders/new?duplicate=${o.id}`);
  }, [navigate]);

  const onPrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  // ───────── Hotkey ⌘N → new order ─────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === "n" || e.key === "N")) {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        const editing =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (document.activeElement as HTMLElement | null)?.isContentEditable;
        if (editing) return;
        e.preventDefault();
        navigate("/orders/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // ───────── Vues : appliquer une vue sauvegardée ─────────
  const applyView = useCallback(
    (v: SavedView) => {
      setFilters(v.filters);
      setSortRules(v.sort);
      setColumns(v.columns);
    },
    [setFilters, setSortRules, setColumns],
  );

  // ───────── État vide ─────────
  // On distingue : aucune commande globalement vs. zéro résultat après filtres.
  // Si l'opérateur a un filtre actif, on lui montre toujours le "no-results"
  // — même si la liste sous-jacente est vide — pour qu'il sache que ce sont
  // peut-être ses filtres qui cachent la donnée.
  const filtersActive = hasActiveFilters(filters);
  const noOrdersAtAll = !isLoading && !filtersActive && rawOrders.length === 0;
  const noResultsForFilters = !isLoading && filtered.length === 0 && filtersActive;

  // Chips effaçables des filtres actifs (pour l'EmptyState "no-results").
  const activeFilterChips = useMemo(() => {
    if (!filtersActive) return [];
    const chips: Array<{ label: string; onClear: () => void }> = [];
    for (const s of filters.statuts) {
      chips.push({
        label: `Statut: ${STATUS_LABELS[s]}`,
        onClear: () =>
          patchFilters({ statuts: filters.statuts.filter((x) => x !== s) }),
      });
    }
    for (const sec of filters.secteurs) {
      chips.push({
        label: `Secteur: ${SECTEUR_LABELS[sec]}`,
        onClear: () =>
          patchFilters({ secteurs: filters.secteurs.filter((x) => x !== sec) }),
      });
    }
    for (const a of filters.assignes) {
      chips.push({
        label: a === "unassigned" ? "Non assigné" : `Assigné: ${a}`,
        onClear: () =>
          patchFilters({ assignes: filters.assignes.filter((x) => x !== a) }),
      });
    }
    if (filters.client_id) {
      const c = clients.find((x) => x.id === filters.client_id);
      chips.push({
        label: `Client: ${c?.nom ?? "?"}`,
        onClear: () => patchFilters({ client_id: null }),
      });
    }
    if (filters.date.preset || filters.date.from || filters.date.to) {
      chips.push({
        label: "Date",
        onClear: () => patchFilters({ date: { preset: null, from: null, to: null } }),
      });
    }
    if (filters.urgent) {
      chips.push({
        label: "Urgents",
        onClear: () => patchFilters({ urgent: false }),
      });
    }
    if (filters.bat_state) {
      chips.push({
        label: `BAT: ${filters.bat_state}`,
        onClear: () => patchFilters({ bat_state: null }),
      });
    }
    if (filters.q.trim()) {
      chips.push({
        label: `« ${filters.q.trim()} »`,
        onClear: () => patchFilters({ q: "" }),
      });
    }
    return chips;
  }, [filters, filtersActive, patchFilters, clients]);

  // Replie tout quand le filtrage réduit drastiquement la liste.
  useEffect(() => {
    if (filtered.length === 0) collapseAll();
  }, [filtered.length, collapseAll]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
        minHeight: 0,
      }}
    >
      <OrdersToolbar
        summary={summary}
        density={density}
        onDensityChange={setDensity}
        columns={columns}
        onColumnsChange={setColumns}
        views={views}
        snapshot={{ filters, sort: sortRules, columns }}
        onSaveView={saveView}
        onApplyView={applyView}
        onDeleteView={deleteView}
        onCreateOrder={() => navigate("/orders/new")}
      />

      <FiltersBar filters={filters} patch={patchFilters} onReset={reset} />

      {noOrdersAtAll ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "white",
            border: "1px solid var(--brand-sage-100)",
            borderRadius: 12,
          }}
        >
          <EmptyState
            variant="no-orders"
            onCreate={() => navigate("/orders/new")}
          />
        </div>
      ) : noResultsForFilters ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "white",
            border: "1px solid var(--brand-sage-100)",
            borderRadius: 12,
          }}
        >
          <EmptyState
            variant="no-results"
            activeFilterChips={activeFilterChips}
            onReset={() => {
              reset();
              setFilters(EMPTY_FILTERS);
            }}
          />
        </div>
      ) : (
        <OrderListTable
          orders={sorted}
          visibleColumns={columns}
          density={density}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          sortRules={sortRules}
          onSortChange={setSortRules}
          onOpenOrder={(id) => setDetailId(id)}
          footerSummary={summary}
        />
      )}

      <OrderDetailPanel
        orderId={detailId}
        navList={navOrderIds}
        cache={ordersById}
        onClose={() => setDetailId(null)}
        onNavigate={(id) => setDetailId(id)}
        onOpenEdit={(id) => {
          setDetailId(null);
          setEditingId(id);
        }}
        onDuplicate={onDuplicate}
        onPrint={onPrint}
      />

      <OrderEditDrawer orderId={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}

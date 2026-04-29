import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { useCatalogTree } from "@/hooks/useCatalog";
import type { CatalogProduct, NeckType, SleeveType } from "@/lib/catalog";
import { useFlashDevisV2Store } from "../store";
import { ProductCard } from "./ProductCard";

const SLEEVE_OPTIONS: Array<{ value: SleeveType; label: string }> = [
  { value: "courte", label: "Manche courte" },
  { value: "longue", label: "Manche longue" },
  { value: "sans_manche", label: "Sans manche" },
];

const NECK_OPTIONS: Array<{ value: NeckType; label: string }> = [
  { value: "rond", label: "Col rond" },
  { value: "v", label: "Col V" },
];

const ROW_HEIGHT = 64;

interface ModelColumnProps {
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

export function ModelColumn({ searchInputRef }: ModelColumnProps = {}) {
  const { data: tree } = useCatalogTree();
  const search = useFlashDevisV2Store((s) => s.search);
  const setSearch = useFlashDevisV2Store((s) => s.setSearch);
  const sleeveFilter = useFlashDevisV2Store((s) => s.sleeveFilter);
  const neckFilter = useFlashDevisV2Store((s) => s.neckFilter);
  const toggleSleeveFilter = useFlashDevisV2Store((s) => s.toggleSleeveFilter);
  const toggleNeckFilter = useFlashDevisV2Store((s) => s.toggleNeckFilter);
  const selectedRef = useFlashDevisV2Store((s) => s.selectedModelRef);
  const selectModel = useFlashDevisV2Store((s) => s.selectModel);

  // ── Search debounce 150 ms ──────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 150);
    return () => clearTimeout(t);
  }, [searchInput, setSearch]);

  // Si le store est vidé depuis l'extérieur (ex. Esc dans hook clavier),
  // synchronise le state local de l'input.
  useEffect(() => {
    if (search === "") setSearchInput("");
  }, [search]);

  // ── Liste plate des produits depuis l'arbre catalogue ───────────────
  const allProducts = useMemo<CatalogProduct[]>(() => {
    if (!tree) return [];
    const out: CatalogProduct[] = [];
    for (const fam of tree.families) {
      if (!fam.enabled) continue;
      for (const sf of fam.subfamilies) {
        if (!sf.enabled) continue;
        for (const p of sf.products) {
          if (!p.enabled) continue;
          out.push(p);
        }
      }
    }
    return out;
  }, [tree]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (sleeveFilter.size > 0 && !(p.sleeve_type && sleeveFilter.has(p.sleeve_type))) {
        return false;
      }
      if (neckFilter.size > 0 && !(p.neck_type && neckFilter.has(p.neck_type))) {
        return false;
      }
      if (q && !`${p.reference} ${p.name}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allProducts, sleeveFilter, neckFilter, search]);

  // ── Highlight clavier (local — séparé de la sélection store) ────────
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);
  // Reset le highlight quand la liste filtrée change
  useEffect(() => {
    if (filtered.length === 0) {
      setHighlightedIdx(null);
    } else if (highlightedIdx !== null && highlightedIdx >= filtered.length) {
      setHighlightedIdx(filtered.length - 1);
    }
    // ne dépend que de la longueur — éviter de rebondir sur les objets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  // Scroll automatique pour révéler l'item highlight
  useEffect(() => {
    if (highlightedIdx !== null) {
      virtualizer.scrollToIndex(highlightedIdx, { align: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedIdx]);

  function handleSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((idx) => {
        if (idx === null) return 0;
        return (idx + 1) % filtered.length;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((idx) => {
        if (idx === null) return 0;
        return (idx - 1 + filtered.length) % filtered.length;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[highlightedIdx ?? 0];
      if (target) {
        selectModel(target.reference);
      }
      return;
    }
  }

  return (
    <aside
      aria-label="Catalogue modèles"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        borderRight: "1px solid rgba(74,98,116,0.10)",
        background: "rgba(244,244,242,0.6)",
      }}
    >
      <div
        style={{
          padding: "12px 12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderBottom: "1px solid rgba(74,98,116,0.08)",
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--fg-3)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Rechercher (réf. ou nom)…  ( / )"
            aria-label="Rechercher un modèle"
            style={{
              width: "100%",
              padding: "8px 10px 8px 30px",
              borderRadius: 8,
              border: "1px solid rgba(74,98,116,0.18)",
              fontSize: 13,
              background: "#fff",
              outline: "none",
            }}
          />
        </div>

        <FilterChipGroup
          label="Manche"
          options={SLEEVE_OPTIONS}
          active={sleeveFilter}
          onToggle={toggleSleeveFilter}
        />
        <FilterChipGroup
          label="Encolure"
          options={NECK_OPTIONS}
          active={neckFilter}
          onToggle={toggleNeckFilter}
        />
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 8 }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              fontSize: 12.5,
              color: "var(--fg-3)",
            }}
          >
            Aucun modèle ne correspond aux filtres.
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const product = filtered[vi.index];
              const isHighlighted = vi.index === highlightedIdx;
              return (
                <div
                  key={product.id}
                  data-highlighted={isHighlighted ? "true" : undefined}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                    padding: "0 4px 8px",
                    outline: isHighlighted
                      ? "2px solid var(--brand-duck-500)"
                      : "none",
                    outlineOffset: -2,
                    borderRadius: 12,
                  }}
                >
                  <ProductCard
                    product={product}
                    active={product.reference === selectedRef}
                    onSelect={() => {
                      setHighlightedIdx(vi.index);
                      selectModel(product.reference);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function FilterChipGroup<T extends string>({
  label,
  options,
  active,
  onToggle,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  active: Set<T>;
  onToggle: (v: T) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg-4)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map((opt) => {
          const isActive = active.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              aria-pressed={isActive}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: `1px solid ${
                  isActive ? "var(--brand-duck-500)" : "rgba(74,98,116,0.18)"
                }`,
                background: isActive ? "var(--brand-duck-500)" : "#fff",
                color: isActive ? "var(--fg-on-primary)" : "var(--fg-2)",
                fontSize: 11.5,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

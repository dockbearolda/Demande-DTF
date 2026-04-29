import { memo, useMemo } from "react";
import { Search, X } from "lucide-react";

import type { SupplierModelDTO } from "@/hooks/useSupplierCatalog";
import type {
  CatalogFiltersResult,
  Genre,
  Material,
  ProductType,
} from "./useCatalogFilters";

interface CatalogFiltersProps {
  filters: CatalogFiltersResult;
  /** Tous les modèles disponibles — sert à dériver les couleurs proposées
   *  et les compteurs par segment. */
  allModels: SupplierModelDTO[];
}

const GENRES: Array<{ id: Genre; label: string }> = [
  { id: "HOMME", label: "Homme" },
  { id: "FEMME", label: "Femme" },
  { id: "ENFANT", label: "Enfant" },
  { id: "BEBE", label: "Bébé" },
];

const TYPES: Array<{ id: ProductType; label: string }> = [
  { id: "tshirt", label: "T-shirt" },
  { id: "polo", label: "Polo" },
  { id: "sweat", label: "Sweat" },
  { id: "hoodie", label: "Hoodie" },
  { id: "veste", label: "Veste" },
  { id: "debardeur", label: "Débardeur" },
];

const MATERIALS: Array<{ id: Material; label: string }> = [
  { id: "coton", label: "Coton" },
  { id: "polyester", label: "Polyester" },
  { id: "melange", label: "Mélangé" },
];

/**
 * Barre de filtres avancés du panel catalogue. Empile :
 *   1. Recherche full-text (debounced 200ms côté hook)
 *   2. Segments Genre (Homme/Femme/Enfant/Bébé) — multi-select
 *   3. Couleur disponible — chips swatch horizontalement scrollables
 *   4. Type produit (T-shirt, Polo, Sweat…) — chips multi-select
 *   5. Matière (Coton, Polyester, Mélangé) — chips multi-select
 *
 * Combinaison AND : chaque ajout réduit la liste, le compteur de résultats
 * (rendu à l'extérieur) reflète la sélection en live. Bouton « Effacer »
 * apparaît dès qu'au moins un filtre est actif.
 */
export const CatalogFilters = memo(function CatalogFilters({
  filters,
  allModels,
}: CatalogFiltersProps) {
  const {
    state,
    setSearch,
    toggleGenre,
    toggleColor,
    toggleType,
    toggleMaterial,
    clearAll,
    hasActiveFilters,
  } = filters;

  // Couleurs proposées : on agrège toutes les couleurs activées et on
  // ne garde qu'une entrée par slug, en privilégiant l'occurrence la
  // plus représentée pour le label/hex affichés.
  const colorOptions = useMemo(() => {
    const counts = new Map<
      string,
      { slug: string; label: string; hex: string | null; count: number }
    >();
    for (const m of allModels) {
      for (const c of m.colors) {
        if (!c.enabled) continue;
        const cur = counts.get(c.slug);
        if (cur) cur.count += 1;
        else
          counts.set(c.slug, {
            slug: c.slug,
            label: c.label,
            hex: c.hex,
            count: 1,
          });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [allModels]);

  return (
    <div className="flex flex-col gap-s-3 border-b border-ink-100 bg-ink-25 px-s-5 py-s-4">
      {/* ── Search ── */}
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-s-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <input
          type="search"
          value={state.search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par référence, marque ou nom…"
          aria-label="Recherche catalogue"
          className="h-10 w-full rounded-r-2 border border-ink-200 bg-white pl-9 pr-s-3 text-[13px] text-ink-800 placeholder:text-ink-400 transition-colors duration-mid ease-out-soft focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
        />
        {state.search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Effacer la recherche"
            className="absolute right-s-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-r-pill text-ink-400 transition-colors duration-mid ease-out-soft hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── Genre segments ── */}
      <FilterRow label="Genre">
        {GENRES.map((g) => (
          <ChipToggle
            key={g.id}
            active={state.genres.has(g.id)}
            onClick={() => toggleGenre(g.id)}
          >
            {g.label}
          </ChipToggle>
        ))}
      </FilterRow>

      {/* ── Color swatches ── */}
      {colorOptions.length > 0 && (
        <FilterRow label="Couleur">
          <div className="flex min-w-0 flex-1 gap-s-2 overflow-x-auto pr-s-1">
            {colorOptions.map((c) => (
              <ColorSwatchToggle
                key={c.slug}
                slug={c.slug}
                label={c.label}
                hex={c.hex}
                active={state.colorSlugs.has(c.slug)}
                onClick={() => toggleColor(c.slug)}
              />
            ))}
          </div>
        </FilterRow>
      )}

      {/* ── Product type ── */}
      <FilterRow label="Type">
        {TYPES.map((t) => (
          <ChipToggle
            key={t.id}
            active={state.types.has(t.id)}
            onClick={() => toggleType(t.id)}
          >
            {t.label}
          </ChipToggle>
        ))}
      </FilterRow>

      {/* ── Material ── */}
      <FilterRow label="Matière">
        {MATERIALS.map((m) => (
          <ChipToggle
            key={m.id}
            active={state.materials.has(m.id)}
            onClick={() => toggleMaterial(m.id)}
          >
            {m.label}
          </ChipToggle>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto inline-flex h-7 items-center gap-s-1 rounded-r-pill px-s-3 text-[12px] font-semibold text-ink-500 transition-colors duration-mid ease-out-soft hover:bg-ink-100 hover:text-ink-800"
          >
            <X size={12} strokeWidth={2.25} aria-hidden="true" />
            Effacer
          </button>
        )}
      </FilterRow>
    </div>
  );
});

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-s-3">
      <span className="w-16 flex-none text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-s-2">
        {children}
      </div>
    </div>
  );
}

function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center rounded-r-pill border px-s-3 text-[12px] font-semibold transition-all duration-mid ease-out-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 ${
        active
          ? "border-accent-500 bg-accent-500 text-white shadow-1"
          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-800"
      }`}
    >
      {children}
    </button>
  );
}

function ColorSwatchToggle({
  slug,
  label,
  hex,
  active,
  onClick,
}: {
  slug: string;
  label: string;
  hex: string | null;
  active: boolean;
  onClick: () => void;
}) {
  // Bord léger pour les couleurs très claires (blanc, écru) qui se confondent
  // avec le fond — détection naïve sur la luminance approximative du hex.
  const isLight = useMemo(() => {
    if (!hex) return false;
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return false;
    const v = parseInt(m[1], 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 230;
  }, [hex]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}${active ? " (sélectionné)" : ""}`}
      title={label}
      className={`relative flex-none overflow-hidden rounded-r-pill transition-all duration-mid ease-out-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
        active
          ? "h-6 w-6 ring-2 ring-accent-500 ring-offset-1"
          : "h-5 w-5 ring-0 hover:ring-1 hover:ring-ink-300 hover:ring-offset-1"
      }`}
      data-color-slug={slug}
      style={{
        backgroundColor: hex ?? "var(--ink-200)",
        boxShadow: isLight ? "inset 0 0 0 1px var(--ink-200)" : undefined,
      }}
    />
  );
}

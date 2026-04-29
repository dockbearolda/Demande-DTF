import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, X } from "lucide-react";

import {
  absoluteMockupUrl,
  useSupplierCatalog,
  type SupplierColorDTO,
  type SupplierModelDTO,
} from "@/hooks/useSupplierCatalog";

import { CatalogFilters } from "./CatalogFilters";
import { ProductCard } from "./ProductCard";
import { useCatalogFilters } from "./useCatalogFilters";

const PANEL_BASE_PRICE_EUR = 10;

interface CatalogPanelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: {
    refInternal: string;
    colorSlug: string;
    model: SupplierModelDTO;
    color: SupplierColorDTO;
  }) => void;
}

/**
 * Panneau latéral droit (720px) pour choisir une référence textile dans le
 * catalogue fournisseur. Remplace la modale plein-écran historique.
 *
 * Caractéristiques :
 *   - Slide-in depuis la droite, animation translate-x sur 280ms (sous le
 *     budget < 300ms requis par l'acceptance criteria).
 *   - Overlay assombri à 40% — le rail droit du devis (QuoteSummary +
 *     DeliveryTimeline) reste visible derrière, pour ne pas perdre le
 *     contexte du devis pendant la sélection.
 *   - Flux deux temps : (1) liste produits filtrable, (2) sélection couleur
 *     du modèle choisi. Le double-clic sur une card court-circuite l'étape 2
 *     en sélectionnant la 1ère couleur dispo.
 *   - Filtres (search debounced 200ms + genre + couleur + type + matière)
 *     persistés dans l'URL pour deep-link / partage.
 *   - Fermeture : × / Esc / clic sur l'overlay.
 *
 * Le portail le sort du DOM parent pour éviter tout `overflow: hidden` qui
 * couperait l'animation, et le z-index 70 le place au-dessus de la sidebar
 * OMS sans perturber les toasts (z-90+).
 */
export const CatalogPanel = memo(function CatalogPanel({
  open,
  onClose,
  onSelect,
}: CatalogPanelProps) {
  const { data, isLoading, error } = useSupplierCatalog();

  const allModels = useMemo<SupplierModelDTO[]>(() => {
    if (!data) return [];
    return data.categories.flatMap((c) => c.models);
  }, [data]);

  // Étape interne : sélection modèle (null) ou couleur (model pické).
  const [picked, setPicked] = useState<SupplierModelDTO | null>(null);

  return (
    <CatalogPanelContent
      open={open}
      onClose={onClose}
      onSelect={onSelect}
      data={data}
      allModels={allModels}
      isLoading={isLoading}
      error={error}
      picked={picked}
      setPicked={setPicked}
    />
  );
});

interface CatalogPanelContentProps {
  open: boolean;
  onClose: () => void;
  onSelect: CatalogPanelProps["onSelect"];
  data: ReturnType<typeof useSupplierCatalog>["data"];
  allModels: SupplierModelDTO[];
  isLoading: boolean;
  error: unknown;
  picked: SupplierModelDTO | null;
  setPicked: (m: SupplierModelDTO | null) => void;
}

/**
 * On extrait le contenu dans un sous-composant qui n'est monté que lorsque
 * `open` devient `true`. Cela évite que `useCatalogFilters` ne s'abonne à
 * `useSearchParams` (et n'écrive dans l'URL) tant que le panel n'est pas
 * ouvert — on garde la route `/orders/new` propre quand le panel est fermé.
 */
function CatalogPanelContent({
  open,
  onClose,
  onSelect,
  data,
  allModels,
  isLoading,
  error,
  picked,
  setPicked,
}: CatalogPanelContentProps) {
  if (!open) return null;
  return (
    <CatalogPanelInner
      onClose={onClose}
      onSelect={onSelect}
      data={data}
      allModels={allModels}
      isLoading={isLoading}
      error={error}
      picked={picked}
      setPicked={setPicked}
    />
  );
}

function CatalogPanelInner({
  onClose,
  onSelect,
  data,
  allModels,
  isLoading,
  error,
  picked,
  setPicked,
}: Omit<CatalogPanelContentProps, "open">) {
  const filters = useCatalogFilters({ allModels });

  // ── Anim mount/unmount ───────────────────────────────────────────
  // On force un repaint en passant de "translate-x-full" (initial) à
  // "translate-x-0" pour déclencher la transition CSS — sans ça, le
  // composant apparaît déjà à sa position finale.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = useCallback(() => {
    setPicked(null);
    onClose();
  }, [onClose, setPicked]);

  // ── Esc & focus trap léger ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Si on est sur l'étape couleurs, on recule au lieu de fermer.
      if (picked) {
        e.preventDefault();
        setPicked(null);
        return;
      }
      e.preventDefault();
      handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, setPicked, handleClose]);

  // Empêche le scroll du body pendant que le panel est ouvert — sinon
  // les molettes traversent l'overlay et déplacent la page derrière.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleProductClick = useCallback(
    (model: SupplierModelDTO) => setPicked(model),
    [setPicked],
  );

  const handleProductDoubleClick = useCallback(
    (model: SupplierModelDTO) => {
      const firstColor = model.colors.find((c) => c.enabled);
      if (!firstColor) {
        // Pas de couleur dispo → bascule sur la vue couleurs (vide) pour
        // que l'utilisateur voie l'état explicite plutôt qu'un no-op.
        setPicked(model);
        return;
      }
      onSelect({
        refInternal: model.ref_internal,
        colorSlug: firstColor.slug,
        model,
        color: firstColor,
      });
      handleClose();
    },
    [onSelect, handleClose, setPicked],
  );

  const handleColorPick = useCallback(
    (model: SupplierModelDTO, color: SupplierColorDTO) => {
      onSelect({
        refInternal: model.ref_internal,
        colorSlug: color.slug,
        model,
        color,
      });
      handleClose();
    },
    [onSelect, handleClose],
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-panel-title"
      className="fixed inset-0 z-[70] flex"
    >
      {/* ── Overlay 40% — laisse le rail devis visible en arrière-plan ── */}
      <button
        type="button"
        aria-label="Fermer le panneau"
        tabIndex={-1}
        onClick={handleClose}
        className={`absolute inset-0 cursor-default bg-ink-900/40 backdrop-blur-[2px] transition-opacity duration-mid ease-out-soft ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* ── Panel ── */}
      <aside
        className={`relative ml-auto flex h-full w-full max-w-[720px] flex-col overflow-hidden bg-white shadow-3 transition-transform duration-slow ease-snap ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
        // Le panel reçoit le focus au montage pour permettre Esc + tab nav
        // sans clic préalable.
        ref={useFocusOnMount}
        tabIndex={-1}
      >
        <PanelHeader
          picked={picked}
          onBack={() => setPicked(null)}
          onClose={handleClose}
          totalModels={data?.total_models}
          totalColors={data?.total_colors}
        />

        {/* État chargement / erreur */}
        {isLoading && (
          <div className="flex flex-1 items-center justify-center text-[13px] text-ink-500">
            Chargement du catalogue…
          </div>
        )}
        {error != null && (
          <div className="flex flex-1 items-center justify-center px-s-6 text-center text-[13px] text-danger-500">
            <div>
              <div className="font-semibold">Catalogue indisponible</div>
              <div className="mt-s-1 text-danger-500/80">
                Vérifie que l'API tourne et que le seed est appliqué.
              </div>
            </div>
          </div>
        )}

        {/* ── Vue 1 : produits ─────────────────────────────────────── */}
        {data && !picked && (
          <>
            <CatalogFilters filters={filters} allModels={allModels} />
            <ResultsBar
              count={filters.filteredModels.length}
              total={allModels.length}
              hasFilters={filters.hasActiveFilters}
            />
            <div className="flex-1 overflow-y-auto bg-white px-s-5 py-s-4">
              {filters.filteredModels.length === 0 ? (
                <EmptyState search={filters.state.search} />
              ) : (
                <div className="grid grid-cols-3 gap-s-3 sm:grid-cols-4 md:grid-cols-5">
                  {filters.filteredModels.map((m) => (
                    <ProductCard
                      key={m.id}
                      model={m}
                      basePrice={PANEL_BASE_PRICE_EUR}
                      onClick={() => handleProductClick(m)}
                      onDoubleClick={() => handleProductDoubleClick(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Vue 2 : couleurs du modèle pické ─────────────────────── */}
        {picked && (
          <ColorStep model={picked} onPick={(c) => handleColorPick(picked, c)} />
        )}
      </aside>
    </div>,
    document.body,
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function PanelHeader({
  picked,
  onBack,
  onClose,
  totalModels,
  totalColors,
}: {
  picked: SupplierModelDTO | null;
  onBack: () => void;
  onClose: () => void;
  totalModels?: number;
  totalColors?: number;
}) {
  return (
    <header className="flex h-14 flex-none items-center gap-s-3 border-b border-ink-100 bg-white px-s-5">
      {picked && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste produits"
          className="inline-flex h-8 w-8 items-center justify-center rounded-r-2 text-ink-500 transition-colors duration-mid ease-out-soft hover:bg-ink-100 hover:text-ink-900"
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h2
          id="catalog-panel-title"
          className="truncate text-[14px] font-semibold tracking-tight text-ink-900"
        >
          {picked
            ? `Choisir une couleur — ${picked.ref_label}`
            : "Catalogue fournisseur"}
        </h2>
        {!picked && totalModels != null && (
          <p className="text-[11px] text-ink-500">
            {totalModels} modèles · {totalColors ?? 0} couleurs
          </p>
        )}
        {picked && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-500">
            {picked.ref_supplier}
            {picked.brand ? ` · ${picked.brand}` : ""}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer le panneau"
        className="inline-flex h-8 w-8 items-center justify-center rounded-r-2 text-ink-500 transition-colors duration-mid ease-out-soft hover:bg-ink-100 hover:text-ink-900"
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </header>
  );
}

function ResultsBar({
  count,
  total,
  hasFilters,
}: {
  count: number;
  total: number;
  hasFilters: boolean;
}) {
  return (
    <div
      className="flex h-9 flex-none items-center justify-between border-b border-ink-100 bg-white px-s-5 text-[11.5px] text-ink-500"
      aria-live="polite"
    >
      <span>
        <span className="font-mono font-semibold tabular-nums text-ink-800">
          {count}
        </span>{" "}
        {hasFilters ? "résultats" : "modèles"}
        {hasFilters && total > 0 && (
          <span className="text-ink-400"> · sur {total}</span>
        )}
      </span>
      <span className="text-[10.5px] uppercase tracking-wider text-ink-400">
        Clic : couleur · Double-clic : sélection rapide
      </span>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-s-6 py-s-12 text-center">
      <p className="text-[14px] font-semibold text-ink-700">
        Aucune référence trouvée
      </p>
      <p className="mt-s-1 text-[12.5px] text-ink-500">
        {search
          ? `Aucun produit ne correspond à « ${search} » avec les filtres actifs.`
          : "Aucun produit ne correspond aux filtres actifs."}
      </p>
    </div>
  );
}

function ColorStep({
  model,
  onPick,
}: {
  model: SupplierModelDTO;
  onPick: (color: SupplierColorDTO) => void;
}) {
  const enabled = model.colors.filter((c) => c.enabled);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-9 flex-none items-center border-b border-ink-100 bg-white px-s-5 text-[11.5px] text-ink-500">
        <span>
          <span className="font-mono font-semibold tabular-nums text-ink-800">
            {enabled.length}
          </span>{" "}
          couleurs disponibles
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-white px-s-5 py-s-4">
        <div className="grid grid-cols-3 gap-s-3 sm:grid-cols-4 md:grid-cols-5">
          {enabled.map((c) => (
            <ColorCard key={c.id} color={c} onClick={() => onPick(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorCard({
  color,
  onClick,
}: {
  color: SupplierColorDTO;
  onClick: () => void;
}) {
  const front = color.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
  const url = front ? absoluteMockupUrl(front.url) : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-r-3 border border-ink-100 bg-white text-left transition-all duration-mid ease-out-soft hover:border-accent-500 hover:shadow-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-ink-25">
        {url ? (
          <img
            src={url}
            alt={color.label}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-base ease-out-soft group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: color.hex ?? "var(--ink-200)" }}
            aria-hidden="true"
          />
        )}
        <span className="absolute bottom-s-2 left-s-2 inline-flex h-4 w-4 rounded-r-pill border border-white/85 shadow-1">
          <span
            className="h-full w-full rounded-r-pill"
            style={{ backgroundColor: color.hex ?? "var(--ink-200)" }}
          />
        </span>
        <span className="pointer-events-none absolute right-s-2 top-s-2 hidden rounded-r-pill bg-accent-500 p-s-1 text-white shadow-1 group-hover:inline-flex">
          <Check size={12} strokeWidth={2.25} aria-hidden="true" />
        </span>
      </div>
      <div className="px-s-3 py-s-2">
        <div className="line-clamp-1 text-[12.5px] font-semibold text-ink-800">
          {color.label}
        </div>
      </div>
    </button>
  );
}

// ─── Utilities ───────────────────────────────────────────────────────

/**
 * Ref callback : pose le focus sur l'élément au montage. Petit helper
 * inline plutôt qu'un useEffect séparé pour garder le composant lisible.
 */
function useFocusOnMount(node: HTMLElement | null) {
  if (node && document.activeElement !== node) {
    // Ne pas voler le focus à un input enfant (le champ recherche) si
    // celui-ci a déjà été focusé par un autre flux.
    const insideInput =
      document.activeElement &&
      node.contains(document.activeElement) &&
      document.activeElement.tagName === "INPUT";
    if (!insideInput) node.focus();
  }
}

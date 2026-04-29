/**
 * Modal plein-écran pour choisir une référence textile dans le catalogue
 * fournisseur (`/catalog/supplier/tree`).
 *
 * Flux en deux temps :
 *   1. Choix du modèle : tabs catégorie + recherche + grille de cards.
 *   2. Choix de la couleur : grille des couleurs du modèle, mockup front en
 *      vignette pour chacune.
 *
 * À la sélection finale, on appelle `onSelect({ refInternal, colorSlug })`.
 * Le parent décide quoi en faire (typiquement : poser le modelId sur la
 * ligne textile en cours et activer la couleur dans le store).
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Fuse from "fuse.js";
import { Search, X, ChevronLeft, Check } from "lucide-react";
import {
  useSupplierCatalog,
  type SupplierColorDTO,
  type SupplierModelDTO,
  absoluteMockupUrl,
} from "@/hooks/useSupplierCatalog";

const CATEGORY_TABS: { id: string; label: string }[] = [
  { id: "HOMME", label: "Homme" },
  { id: "FEMME", label: "Femme" },
  { id: "ENFANT", label: "Enfant" },
  { id: "BEBE", label: "Bébé" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: {
    refInternal: string;
    colorSlug: string;
    model: SupplierModelDTO;
    color: SupplierColorDTO;
  }) => void;
  /** Catégorie initiale (par défaut : HOMME). */
  initialCategory?: string;
}

export function SupplierReferencePicker({
  open,
  onClose,
  onSelect,
  initialCategory = "HOMME",
}: Props) {
  const { data, isLoading, error } = useSupplierCatalog();
  const [category, setCategory] = useState<string>(initialCategory);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<SupplierModelDTO | null>(null);

  // Reset à la fermeture pour repartir propre la prochaine fois.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setPicked(null);
      setCategory(initialCategory);
    }
  }, [open, initialCategory]);

  // Échap : recule (modèle → liste, liste → ferme).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (picked) setPicked(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, picked, onClose]);

  const allModels = useMemo<SupplierModelDTO[]>(() => {
    if (!data) return [];
    return data.categories.flatMap((c) => c.models);
  }, [data]);

  const modelsForCategory = useMemo<SupplierModelDTO[]>(() => {
    if (!data) return [];
    const cat = data.categories.find((c) => c.category === category);
    return cat?.models ?? [];
  }, [data, category]);

  const fuse = useMemo(
    () =>
      new Fuse(allModels, {
        keys: [
          { name: "ref_internal", weight: 0.9 },
          { name: "ref_supplier", weight: 1.0 },
          { name: "ref_label", weight: 0.7 },
          { name: "brand", weight: 0.5 },
          { name: "name", weight: 0.5 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [allModels],
  );

  const visibleModels = useMemo<SupplierModelDTO[]>(() => {
    const q = search.trim();
    if (q.length >= 2) {
      // Recherche transverse à toutes les catégories quand l'user tape.
      return fuse.search(q).map((r) => r.item);
    }
    return modelsForCategory;
  }, [search, fuse, modelsForCategory]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-picker-title"
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-900/40 px-4 py-6 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            {picked && (
              <button
                type="button"
                onClick={() => setPicked(null)}
                aria-label="Retour à la liste"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h2
              id="supplier-picker-title"
              className="text-[15px] font-bold text-slate-900"
            >
              {picked
                ? `Choisir une couleur — ${picked.ref_label}`
                : "Choisir une référence fournisseur"}
            </h2>
            {data && !picked && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {data.total_models} modèles · {data.total_colors} couleurs
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </header>

        {/* État chargement / erreur */}
        {isLoading && (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-500">
            Chargement du catalogue…
          </div>
        )}
        {error && (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[13px] text-rose-700">
            <div>
              <div className="font-semibold">
                Impossible de charger le catalogue fournisseur
              </div>
              <div className="mt-1 text-rose-600">
                Vérifiez que l'API tourne et que le seed a été lancé
                (<code>python cli.py seed-supplier-catalog</code>).
              </div>
            </div>
          </div>
        )}

        {/* Vue 1 : liste des modèles */}
        {data && !picked && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par référence (NS300, K357…), marque ou nom"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-[13px] text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {!search && (
                <div
                  role="tablist"
                  aria-label="Catégorie"
                  className="flex flex-wrap gap-1.5"
                >
                  {CATEGORY_TABS.map((tab) => {
                    const count = data.categories.find((c) => c.category === tab.id)
                      ?.models.length ?? 0;
                    if (count === 0) return null;
                    const active = category === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setCategory(tab.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition ${
                          active
                            ? "border-[#4A6274] bg-[#4A6274]/10 text-[#3a4e5d]"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                            active ? "bg-[#4A6274]/20 text-[#3a4e5d]" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-4">
              {visibleModels.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-slate-500">
                  Aucune référence trouvée
                  {search ? ` pour « ${search} »` : ""}.
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  {visibleModels.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      onClick={() => setPicked(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vue 2 : couleurs du modèle */}
        {picked && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="text-[12px] uppercase tracking-wider text-slate-500">
                {picked.ref_supplier}
                {picked.brand ? ` · ${picked.brand}` : ""}
              </div>
              <div className="mt-0.5 text-[13px] font-semibold text-slate-700">
                {picked.colors.length} couleurs disponibles
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                {picked.colors
                  .filter((c) => c.enabled)
                  .map((c) => (
                    <ColorCard
                      key={c.id}
                      color={c}
                      onClick={() =>
                        onSelect({
                          refInternal: picked.ref_internal,
                          colorSlug: c.slug,
                          model: picked,
                          color: c,
                        })
                      }
                    />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function ModelCard({
  model,
  onClick,
}: {
  model: SupplierModelDTO;
  onClick: () => void;
}) {
  // On prend le premier mockup front de la première couleur dispo comme thumbnail.
  const thumbUrl = useMemo(() => {
    for (const c of model.colors) {
      const front = c.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
      if (front) return absoluteMockupUrl(front.url);
    }
    return undefined;
  }, [model]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border-2 border-slate-200 bg-white text-left transition hover:border-[#4A6274] hover:shadow-md focus:outline-none focus-visible:border-[#4A6274] focus-visible:ring-2 focus-visible:ring-[#4A6274]/30"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">
            Pas de visuel
          </div>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 backdrop-blur">
          {model.colors.length} couleurs
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {model.ref_supplier}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[13px] font-bold text-slate-800">
          {model.name ?? model.ref_label}
        </div>
        {model.fabric_weight_gsm && (
          <div className="mt-0.5 text-[11px] text-slate-500">
            {model.fabric_weight_gsm} g/m²
          </div>
        )}
      </div>
    </button>
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
      className="group flex flex-col overflow-hidden rounded-xl border-2 border-slate-200 bg-white text-left transition hover:border-[#4A6274] hover:shadow-md focus:outline-none focus-visible:border-[#4A6274] focus-visible:ring-2 focus-visible:ring-[#4A6274]/30"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
        {url ? (
          <img
            src={url}
            alt={color.label}
            loading="lazy"
            className="h-full w-full object-contain transition group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ backgroundColor: color.hex ?? "#cccccc" }}
            aria-hidden="true"
          />
        )}
        <span className="absolute bottom-1.5 left-1.5 inline-flex h-4 w-4 rounded-full border border-white/80 shadow-sm">
          <span
            className="h-full w-full rounded-full"
            style={{ backgroundColor: color.hex ?? "#cccccc" }}
          />
        </span>
        <span className="absolute right-1.5 top-1.5 hidden rounded-full bg-[#4A6274] p-1 text-white shadow-sm group-hover:inline-flex">
          <Check size={12} />
        </span>
      </div>
      <div className="px-3 py-2">
        <div className="line-clamp-1 text-[12.5px] font-semibold text-slate-800">
          {color.label}
        </div>
      </div>
    </button>
  );
}

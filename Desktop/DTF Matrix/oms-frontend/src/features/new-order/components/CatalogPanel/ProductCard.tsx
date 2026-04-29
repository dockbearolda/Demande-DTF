import { memo, useMemo, useState } from "react";
import { Sparkles, Flame } from "lucide-react";
import {
  absoluteMockupUrl,
  type SupplierModelDTO,
} from "@/hooks/useSupplierCatalog";

interface ProductCardProps {
  model: SupplierModelDTO;
  /** Référence sélectionnée — applique un état actif visuel. */
  selected?: boolean;
  /** Sélection inline (= passage à l'étape couleur du panel). */
  onClick: () => void;
  /** Sélection rapide (= sélectionne et ferme le panel). */
  onDoubleClick: () => void;
  /** Prix base affiché en hover preview. Optionnel : caché si non fourni. */
  basePrice?: number;
  /** Petit badge gauche-haut « Nouveau ». */
  isNew?: boolean;
  /** Petit badge droit-haut « Populaire ». */
  isPopular?: boolean;
}

const FR_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Card produit du panel catalogue. Image carrée en haut, libellé compact en
 * bas, et un overlay « hover preview » qui apparaît au survol pour révéler
 * poids / composition / prix base sans cliquer. Le clic simple sélectionne
 * la référence (passe à l'étape couleur dans le panel) ; le double-clic
 * sélectionne avec la 1ère couleur dispo et ferme le panel — racourci pour
 * un commercial qui sait déjà ce qu'il veut.
 */
export const ProductCard = memo(function ProductCard({
  model,
  selected,
  onClick,
  onDoubleClick,
  basePrice,
  isNew,
  isPopular,
}: ProductCardProps) {
  const [hovered, setHovered] = useState(false);

  // Premier mockup front d'une couleur active comme thumbnail.
  const thumbUrl = useMemo(() => {
    for (const c of model.colors) {
      if (!c.enabled) continue;
      const front = c.mockups.find((m) => m.view === "front" && !m.is_lifestyle);
      if (front) return absoluteMockupUrl(front.url);
    }
    return undefined;
  }, [model]);

  const colorCount = model.colors.filter((c) => c.enabled).length;

  // Composition lisible : on tronque à 32 char pour éviter de défoncer
  // la hauteur de la card hover. Sur les compositions longues, l'utilisateur
  // verra le détail dans la fiche produit.
  const compositionLabel = (model.fabric_composition ?? "").slice(0, 36).trim();
  const weightLabel = model.fabric_weight_gsm
    ? `${model.fabric_weight_gsm} g/m²`
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-pressed={selected || undefined}
      aria-label={`${model.name ?? model.ref_label} — ${model.ref_supplier}, ${colorCount} couleurs disponibles`}
      title="Clic : choisir la couleur · Double-clic : sélectionner et fermer"
      className={`group relative flex flex-col overflow-hidden rounded-r-3 border bg-white text-left transition-all duration-mid ease-out-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
        selected
          ? "border-accent-500 shadow-2 ring-1 ring-accent-500"
          : "border-ink-100 hover:border-accent-500 hover:shadow-2"
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-ink-25">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-base ease-out-soft group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-ink-400">
            Pas de visuel
          </div>
        )}

        {/* Badges top */}
        <div className="absolute inset-x-s-2 top-s-2 flex items-start justify-between gap-s-2">
          <div className="flex flex-col items-start gap-s-1">
            {isNew && (
              <span
                className="inline-flex items-center gap-s-1 rounded-r-pill bg-positive-500 px-s-2 py-px text-[10px] font-semibold uppercase tracking-wider text-white shadow-1"
                aria-label="Nouveauté"
              >
                <Sparkles size={10} strokeWidth={2.5} aria-hidden="true" />
                Nouveau
              </span>
            )}
            {isPopular && (
              <span
                className="inline-flex items-center gap-s-1 rounded-r-pill bg-warning-500 px-s-2 py-px text-[10px] font-semibold uppercase tracking-wider text-white shadow-1"
                aria-label="Populaire"
              >
                <Flame size={10} strokeWidth={2.5} aria-hidden="true" />
                Populaire
              </span>
            )}
          </div>
          <span className="rounded-r-pill bg-white/90 px-s-2 py-px text-[10px] font-semibold tabular-nums text-ink-700 backdrop-blur">
            {colorCount}
          </span>
        </div>

        {/* Hover preview overlay — bandeau bas dans l'image. Anime opacity
            + translate depuis le bas pour un effet « tiroir » discret. */}
        <div
          aria-hidden={!hovered}
          className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-s-1 bg-gradient-to-t from-ink-900/85 via-ink-900/55 to-transparent px-s-3 pb-s-2 pt-s-6 text-white transition-all duration-mid ease-out-soft ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <div className="flex items-baseline justify-between gap-s-2">
            {weightLabel && (
              <span className="font-mono text-[10.5px] tabular-nums tracking-tight">
                {weightLabel}
              </span>
            )}
            {typeof basePrice === "number" && basePrice > 0 && (
              <span className="font-mono text-[11px] font-semibold tabular-nums">
                dès {FR_EUR.format(basePrice)}
              </span>
            )}
          </div>
          {compositionLabel && (
            <span className="line-clamp-1 text-[10.5px] leading-tight text-white/85">
              {compositionLabel}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-px px-s-3 py-s-2">
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">
          {model.ref_supplier}
        </div>
        <div className="line-clamp-1 text-[12.5px] font-semibold text-ink-800">
          {model.name ?? model.ref_label}
        </div>
      </div>
    </button>
  );
});

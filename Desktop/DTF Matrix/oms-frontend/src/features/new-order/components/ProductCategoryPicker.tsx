import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Shirt,
  KeyRound,
  CircleDashed,
  Coffee,
  Trophy,
  Gift,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ProductCategoryConfig, ProductCategoryId } from "../constants";
import { PRODUCT_CATEGORIES } from "../constants";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { AutoAdvance } from "@/components/ui/AutoAdvance";
import { Section } from "./primitives";

function getSecteurBadge(_cat: ProductCategoryConfig): string | null {
  // Machine info is system-internal — hidden from operators to reduce cognitive noise.
  return null;
}

// Mapping local : grammaire visuelle alignée sur les autres étapes du wizard
// (qui portent toutes des icônes). Les SVG bruts dans constants.ts ne sont pas
// utilisés ailleurs et resteraient orphelins.
const CATEGORY_ICONS: Record<ProductCategoryId, LucideIcon> = {
  textile: Shirt,
  "porte-cles-plexiglass": KeyRound,
  "porte-cles-acrylique": CircleDashed,
  "tasses-gourdes": Coffee,
  "trophees-medailles": Trophy,
  goodies: Gift,
  "sourcing-special": Sparkles,
};

interface Props {
  selectedId: string | null;
  onSelect: (cat: ProductCategoryConfig) => void;
  /**
   * Si fourni, déclenché 300 ms après une sélection (annulable par Esc).
   * Ne tire QUE pour les sélections fraîches (pas au remount avec valeur persistée).
   */
  onAutoAdvance?: () => void;
  /** Erreur de validation à afficher (passée à la Section interne). */
  error?: string;
  /** Marque le champ comme requis dans la Section interne (étape grille). */
  required?: boolean;
}

export function ProductCategoryPicker({
  selectedId,
  onSelect,
  onAutoAdvance,
  error,
  required,
}: Props) {
  // Compteur incrémenté à chaque sélection utilisateur — déclenche AutoAdvance.
  const [advanceTick, setAdvanceTick] = useState<number>(0);
  // Vue compacte une fois la catégorie choisie : libère l'espace vertical
  // pour les étapes suivantes (référence textile, quantités…), dont la
  // hiérarchie doit dominer ici.
  const [isExpanded, setIsExpanded] = useState<boolean>(!selectedId);

  useEffect(() => {
    if (!selectedId) setIsExpanded(true);
  }, [selectedId]);

  const handleSelect = useCallback(
    (cat: ProductCategoryConfig) => {
      onSelect(cat);
      setAdvanceTick((t) => t + 1);
      setIsExpanded(false);
    },
    [onSelect],
  );

  const selectedCategory = useMemo(
    () => PRODUCT_CATEGORIES.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  // Map index → catégorie pour les touches 1..6
  const shortcuts = useMemo(
    () =>
      PRODUCT_CATEGORIES.slice(0, 9).map((cat, i) => ({
        key: String(i + 1),
        label: `Catégorie ${cat.label}`,
        group: "S1 — Catégories",
        handler: () => handleSelect(cat),
      })),
    [handleSelect],
  );

  useKeyboardShortcuts(shortcuts);

  if (selectedCategory && !isExpanded) {
    return null;
  }

  // ── État édition : grille pleine, encadrée par Section ───────
  return (
    <Section label="Catégorie de produit" required={required} error={error}>
      <div
        role="radiogroup"
        aria-label="Catégorie de produit"
        className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] animate-in fade-in slide-in-from-top-1 duration-200"
      >
        {PRODUCT_CATEGORIES.map((cat, idx) => {
          const isSelected = selectedId === cat.id;
          const badge = getSecteurBadge(cat);
          const hotkey = idx < 9 ? String(idx + 1) : null;
          const Icon = CATEGORY_ICONS[cat.id];

          return (
            <button
              key={cat.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Catégorie ${cat.label}${badge ? ` — ${badge}` : ""}`}
              {...(hotkey ? { "aria-keyshortcuts": hotkey } : {})}
              onClick={() => handleSelect(cat)}
              className={`relative flex min-h-[72px] items-center gap-3 rounded-2xl border-2 px-4 py-3 pr-9 text-left transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[oklch(52%_0.18_255)] ${
                isSelected
                  ? "border-[#4A6274] bg-[#4A6274]/10 text-[#3a4e5d] shadow-sm"
                  : "border-slate-300 bg-white text-slate-900 hover:bg-[#4A6274]/5 hover:border-[#4A6274]/50 hover:shadow-[0_2px_8px_rgba(74,98,116,0.12)]"
              }`}
            >
              {Icon && (
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl transition-colors ${
                    isSelected
                      ? "bg-[#4A6274]/15 text-[#4A6274]"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-[16px] font-bold leading-tight">
                  {cat.label}
                </span>
                {badge && (
                  <span
                    className={`text-[12px] leading-snug ${
                      isSelected ? "text-[#4A6274]/80" : "text-slate-500"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {onAutoAdvance && (
        <AutoAdvance
          active={advanceTick > 0 && !!selectedId}
          resetKey={advanceTick}
          onComplete={onAutoAdvance}
          announcement="La sélection passera à la prochaine étape dans 300 millisecondes. Pressez Échap pour annuler."
        />
      )}
    </Section>
  );
}

import type { ProductCategoryConfig } from "../constants";
import { PRODUCT_CATEGORIES } from "../constants";
import { IconSVG } from "./IconSVG";

function getSecteurBadge(cat: ProductCategoryConfig): string | null {
  if (cat.displaySecteur) return cat.displaySecteur;
  if (cat.autoSecteur) return String(cat.autoSecteur);
  if (cat.id === "goodies") return "Trotec ou UV";
  return null;
}

interface Props {
  selectedId: string | null;
  onSelect: (cat: ProductCategoryConfig) => void;
}

export function ProductCategoryPicker({ selectedId, onSelect }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Catégorie de produit"
      // Mobile: horizontal scroll instead of compressed 3-col grid.
      className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible md:grid-cols-6"
    >
      {PRODUCT_CATEGORIES.map((cat) => {
        const isSelected = selectedId === cat.id;
        const badge = getSecteurBadge(cat);

        return (
          <button
            key={cat.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Catégorie ${cat.label}${badge ? ` — ${badge}` : ""}`}
            onClick={() => onSelect(cat)}
            className={`flex min-h-[88px] min-w-[112px] flex-none snap-start flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all duration-200 active:scale-[0.97] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-w-0 ${
              isSelected
                ? "border-blue-700 bg-blue-50 text-blue-800 shadow-sm"
                : "border-slate-300 bg-white text-slate-900 hover:border-blue-500 hover:bg-blue-50/60 hover:shadow-sm"
            }`}
          >
            <IconSVG
              type={cat.icon as "shirt" | "keys" | "cup" | "trophy" | "gift" | "box"}
              size={28}
              className={isSelected ? "text-blue-700" : "text-slate-700"}
            />
            <span className="w-full text-center text-[13px] font-semibold leading-snug">
              {cat.label}
            </span>
            {badge && (
              <span
                className={`w-full text-center text-[12px] font-semibold uppercase tracking-wide leading-snug ${
                  isSelected ? "text-blue-700" : "text-slate-600"
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

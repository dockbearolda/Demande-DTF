import type { ReactNode } from "react";

export interface QuoteIdentityProps {
  /** Identifiant lisible du devis (ex: "2026-0427-073"). Préfixé `#` à l'affichage. */
  reference: string;
  /** Catégorie / secteur du devis (ex: "Textile", "DTF"). */
  category: string;
  /** Slot optionnel pour une icône / pastille à gauche de la référence. */
  icon?: ReactNode;
}

export function QuoteIdentity({ reference, category, icon }: QuoteIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-s-3">
      {icon && <span className="flex-none text-ink-500">{icon}</span>}
      <div className="flex min-w-0 items-baseline gap-s-2">
        <span
          className="font-mono text-[13px] font-medium tabular-nums text-ink-700"
          aria-label={`Devis numéro ${reference}`}
        >
          Devis #{reference}
        </span>
        <span className="text-ink-300" aria-hidden="true">·</span>
        <span className="truncate text-[13px] font-medium text-ink-500">
          {category}
        </span>
      </div>
    </div>
  );
}

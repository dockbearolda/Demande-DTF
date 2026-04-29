import { memo } from "react";
import { useCountUp } from "../hooks/useCountUp";
import { useQuoteStore } from "../store/useQuoteStore";

const FR_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Total HT live affiché dans le footer sticky. Anime en count-up sur 300ms
 * à chaque changement de la valeur cible (= ajout / suppression / édition
 * de qty), pour rendre tangible l'effet d'une modification de quantité
 * sur le devis sans avoir à scanner la page.
 *
 * `aria-live="polite"` annonce la nouvelle valeur aux lecteurs d'écran
 * sans interrompre la saisie en cours.
 */
export const RunningTotal = memo(function RunningTotal() {
  const { totalAmount } = useQuoteStore();
  const animated = useCountUp(totalAmount, 300);

  // Snap aux décimales seulement à l'affichage — l'easing produit des
  // valeurs flottantes que l'on n'a pas envie de voir trembler en cents
  // pendant l'animation.
  const value = animated > 0 ? FR_EUR.format(animated) : FR_EUR.format(0);

  return (
    <div className="flex items-baseline gap-s-3" aria-live="polite">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        Total HT
      </span>
      <span className="font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">
        {value}
      </span>
    </div>
  );
});

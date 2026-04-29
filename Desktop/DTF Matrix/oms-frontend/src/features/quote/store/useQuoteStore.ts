import { useMemo } from "react";
import {
  selectLines,
  useNewOrderStore,
} from "@/features/new-order/store";
import { computeTotals } from "@/features/new-order/pricing";
import { isTextileLine } from "@/features/new-order/types";

/**
 * Forme exposée au tunnel « Devis Rapide » — vue agrégée des références
 * saisies, projetée pour le rail (QuoteSummary) et le footer (RunningTotal).
 *
 * Ce hook ne possède PAS d'état propre : il dérive en lecture seule de
 * `useNewOrderStore`, qui reste la source de vérité du draft de commande.
 * Cela évite toute désynchronisation entre la saisie (formulaire) et le
 * récap (rail). Pour muter, on utilise les actions de `useNewOrderStore`.
 */
export interface QuoteSummaryView {
  /** Nombre de références (lignes du devis) saisies. */
  references: number;
  /** Total des unités cumulées (somme des qty sur toutes les lignes). */
  totalUnits: number;
  /** Couleurs distinctes utilisées toutes lignes confondues — comptées sur
   *  les TextileItems non-placeholder avec qty > 0. */
  colorCount: number;
  /** Sous-total HT du devis, en euros. Somme des `computeTotals.subtotal`. */
  totalAmount: number;
}

export function useQuoteStore(): QuoteSummaryView {
  const lines = useNewOrderStore(selectLines);

  return useMemo(() => {
    let totalUnits = 0;
    let totalAmount = 0;
    const colors = new Set<string>();

    for (const record of lines) {
      const totals = computeTotals(record.line);
      totalUnits += totals.totalQty;
      totalAmount += totals.subtotal;

      // Agrège les couleurs distinctes au-delà de la frontière des lignes :
      // deux lignes textile qui partagent la même couleur ne la comptent
      // qu'une seule fois — c'est ce qui correspond à un calage machine
      // unique côté production.
      if (isTextileLine(record.line)) {
        for (const item of Object.values(record.line.items)) {
          if (item.isPlaceholder) continue;
          if ((item.qty || 0) <= 0) continue;
          colors.add(item.color);
        }
      }
    }

    return {
      references: lines.length,
      totalUnits,
      totalAmount,
      colorCount: colors.size,
    };
  }, [lines]);
}

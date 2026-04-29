import { memo } from "react";
import { formatEUR } from "@/features/new-order/pricing";
import { useQuoteStore } from "../store/useQuoteStore";

/**
 * Card « Récapitulatif » du rail droit. Trois KPIs en lignes label / value
 * (Références / Articles / Couleurs), suivis d'une zone Total HT séparée
 * par un border-top. Le total est en grand pour ancrer visuellement la
 * lecture du devis — c'est le chiffre qu'un commercial cherche en priorité.
 *
 * Aucun état local : le composant lit directement `useQuoteStore` (vue
 * agrégée dérivée de `useNewOrderStore`).
 */
export const QuoteSummary = memo(function QuoteSummary() {
  const { references, totalUnits, colorCount, totalAmount } = useQuoteStore();

  return (
    <section
      aria-label="Récapitulatif du devis"
      className="rounded-r-4 border border-ink-100 bg-white p-s-5 shadow-1"
    >
      <h3 className="mb-s-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        Récapitulatif
      </h3>

      <dl className="space-y-s-3 text-[13px]">
        <KpiRow label="Références" value={references} />
        <KpiRow label="Articles" value={totalUnits} />
        <KpiRow label="Couleurs" value={colorCount} />
      </dl>

      <div className="mt-s-4 border-t border-ink-100 pt-s-4">
        <div className="flex items-baseline justify-between gap-s-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Total HT
          </span>
          <span className="font-display text-[26px] font-semibold leading-none tracking-tight tabular-nums text-ink-900">
            {totalAmount > 0 ? formatEUR(totalAmount) : "—"}
          </span>
        </div>
      </div>
    </section>
  );
});

interface KpiRowProps {
  label: string;
  value: number;
}

function KpiRow({ label, value }: KpiRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-s-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-mono text-[14px] font-medium tabular-nums text-ink-800">
        {value}
      </dd>
    </div>
  );
}

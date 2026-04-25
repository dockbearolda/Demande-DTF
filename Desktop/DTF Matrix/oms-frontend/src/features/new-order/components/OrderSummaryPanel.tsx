import { memo, useMemo } from "react";
import { computeTotals, formatEUR } from "../pricing";
import { selectHeader, selectLine, useNewOrderStore } from "../store";
import { isClassicLine, isTextileLine } from "../types";
import type { ProductCategoryConfig } from "../constants";
import { DeliveryEstimate } from "./DeliveryEstimate";
import { ProcessTimeline } from "./ProcessTimeline";

interface Props {
  selectedCategory: ProductCategoryConfig | null;
}

export const OrderSummaryPanel = memo(function OrderSummaryPanel({ selectedCategory }: Props) {
  const line = useNewOrderStore(selectLine);
  const header = useNewOrderStore(selectHeader);
  const totals = useMemo(() => computeTotals(line), [line]);

  const productLabel = useMemo(() => {
    if (!line) return null;
    if (isClassicLine(line)) return line.customProduit?.trim() || line.produit || null;
    if (isTextileLine(line)) return line.modelName || null;
    return null;
  }, [line]);

  const detailLabel = useMemo(() => {
    if (!line) return null;
    if (isClassicLine(line)) return line.secteur;
    if (isTextileLine(line)) {
      const items = Object.values(line.items).filter((it) => it.qty > 0 && !it.isPlaceholder);
      if (!items.length) return null;
      const colors = [...new Set(items.map((it) => it.color))];
      const sizes = [...new Set(items.map((it) => it.size))];
      if (colors.length === 1 && sizes.length === 1) return `${colors[0]} · ${sizes[0]}`;
      return `${colors.length} couleur${colors.length > 1 ? "s" : ""} · ${sizes.length} taille${sizes.length > 1 ? "s" : ""}`;
    }
    return null;
  }, [line]);

  const hasPrice = totals.subtotal > 0;
  const hasQty = totals.totalQty > 0;

  return (
    <aside className="hidden lg:block w-[280px] flex-none self-start sticky top-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Récapitulatif
        </h3>

        {!selectedCategory ? (
          <p className="text-xs text-slate-400">
            Sélectionnez une catégorie pour commencer.
          </p>
        ) : (
          <div className="space-y-3">
            <SummaryRow label="Catégorie">
              <span className="font-semibold text-slate-800">{selectedCategory.label}</span>
            </SummaryRow>

            {productLabel && (
              <SummaryRow label="Produit">
                <span className="font-semibold text-slate-800">{productLabel}</span>
              </SummaryRow>
            )}

            {detailLabel && (
              <SummaryRow label="Détail">
                <span className="text-slate-700">{detailLabel}</span>
              </SummaryRow>
            )}

            {hasQty && (
              <SummaryRow label="Quantité">
                <span className="font-semibold text-slate-800">{totals.totalQty} pcs</span>
              </SummaryRow>
            )}

            {hasQty && totals.unitPrice > 0 && (
              <SummaryRow label="Prix unitaire">
                <span className="font-mono text-slate-700">{formatEUR(totals.unitPrice)}</span>
              </SummaryRow>
            )}

            {hasPrice && <hr className="border-slate-100" />}

            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total estimé
              </div>
              <div
                className={`font-mono tabular-nums leading-none font-extrabold ${
                  hasPrice ? "text-[32px] text-blue-600" : "text-2xl text-slate-300"
                }`}
              >
                {hasPrice ? formatEUR(totals.subtotal) : "—"}
              </div>
            </div>

            {totals.nextTier && totals.unitsToNextTier && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                Ajoutez <strong>{totals.unitsToNextTier} pcs</strong> pour passer à{" "}
                <strong>{formatEUR(totals.nextTier.unitPrice)}/u.</strong>
              </div>
            )}

            {hasQty && (
              <DeliveryEstimate
                categoryId={selectedCategory.id}
                totalQty={totals.totalQty}
                isUrgent={header.isUrgent}
                compact
              />
            )}
          </div>
        )}

        {/* Workflow — visible dès qu'une catégorie est choisie */}
        {selectedCategory && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Processus
            </h4>
            <ProcessTimeline current="saisie" compact />
          </div>
        )}
      </div>
    </aside>
  );
});

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex-none text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

import { Plus, Shirt, Trash2, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import {
  DeliveryTimeline,
  buildDeliverySteps,
  PrimaryCta,
  QuoteLayout,
  QuoteSummary,
  RunningTotal,
} from "@/features/quote";
import {
  selectExpandedLineId,
  selectLines,
  useNewOrderStore,
} from "@/features/new-order/store";
import { logger } from "@/lib/logger";
import { isClassicLine } from "@/features/new-order/types";
import type { OrderLineRecord } from "@/features/new-order/types";

/**
 * Page de démonstration du tunnel « Devis Rapide ». Sert à valider
 * visuellement le rail (QuoteSummary + DeliveryTimeline) et le footer
 * (RunningTotal + PrimaryCta) de l'étape 4 de la refonte avant que les
 * cards de saisie réelles ne viennent peupler le `children`.
 *
 * Le body héberge un petit contrôleur démo qui mute `useNewOrderStore`
 * (ajout de référence DTF, édition de qty) — c'est l'unique chemin
 * d'interaction qui prouve, sans le tunnel complet, que le total HT
 * s'anime en count-up à chaque modification (acceptance criteria).
 *
 * Cette page est volontairement montée hors du `<Layout>` global pour
 * éviter le double header (sidebar OMS + header devis) durant l'itération.
 */
export function QuoteDemoPage() {
  const steps = [
    { id: "demande", label: "Demande" },
    { id: "perso", label: "Personnalisation" },
    { id: "validation", label: "Validation" },
  ];

  // Reset propre à l'arrivée sur la page : on n'hérite pas d'un brouillon
  // laissé par /orders/new pour que la démo parte d'un état neutre.
  const reset = useNewOrderStore((s) => s.reset);
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <QuoteLayout
      identity={{
        reference: "2026-0427-073",
        category: "Textile",
        icon: <Shirt size={14} strokeWidth={1.75} aria-hidden="true" />,
      }}
      steps={steps}
      currentStepIndex={0}
      onPrint={() => logger.info("[demo] print")}
      onCancel={() => logger.info("[demo] cancel")}
      summary={
        <>
          <QuoteSummary />
          <DeliveryTimeline steps={buildDeliverySteps("saisie")} />
        </>
      }
      footer={
        <>
          <RunningTotal />
          <PrimaryCta
            label="Continuer vers Personnalisation"
            icon={<ArrowRight size={16} strokeWidth={2} aria-hidden="true" />}
            onClick={() => logger.info("[demo] next step")}
          />
        </>
      }
    >
      <DemoController />
      <ZoneCard title="Test scroll #1">
        <FillerLines count={8} />
      </ZoneCard>
      <ZoneCard title="Test scroll #2">
        <FillerLines count={12} />
      </ZoneCard>
      <ZoneCard title="Test scroll #3 — fin de page">
        <FillerLines count={6} />
        <p className="mt-s-4 text-[12px] text-ink-400">
          Le rail droit doit rester visible, le footer doit flotter en bas.
        </p>
      </ZoneCard>
    </QuoteLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Demo controller — petit panneau pour muter useNewOrderStore et voir
// le rail + footer s'animer en live. Sera supprimé quand les vraies
// ReferenceCard de saisie viendront prendre la place.
// ─────────────────────────────────────────────────────────────────────

const DEMO_PRODUCTS: ReadonlyArray<{ secteur: "DTF"; produit: string; qty: number }> = [
  { secteur: "DTF", produit: "Planche A3", qty: 50 },
  { secteur: "DTF", produit: "Planche A4", qty: 100 },
  { secteur: "DTF", produit: "Transfert nominatif", qty: 20 },
];

function DemoController() {
  const lines = useNewOrderStore(selectLines);
  const expandedId = useNewOrderStore(selectExpandedLineId);
  const addLine = useNewOrderStore((s) => s.addLine);
  const removeLine = useNewOrderStore((s) => s.removeLine);
  const expandLine = useNewOrderStore((s) => s.expandLine);
  const setClassicProduit = useNewOrderStore((s) => s.setClassicProduit);
  const setClassicQty = useNewOrderStore((s) => s.setClassicQty);
  const reset = useNewOrderStore((s) => s.reset);

  const addNext = () => {
    const idx = lines.length % DEMO_PRODUCTS.length;
    const preset = DEMO_PRODUCTS[idx];
    addLine(preset.secteur);
    // `addLine` expand la nouvelle ligne ; les setters classic opèrent
    // sur la ligne dépliée → on peut chaîner sans chercher l'id.
    setClassicProduit(preset.produit);
    setClassicQty(preset.qty);
  };

  const updateQty = (record: OrderLineRecord, delta: number) => {
    if (!isClassicLine(record.line)) return;
    const next = Math.max(0, record.line.quantity + delta);
    if (record.id !== expandedId) expandLine(record.id);
    setClassicQty(next);
  };

  const removeRecord = (id: string) => {
    removeLine(id);
  };

  return (
    <ZoneCard title="Démo — mutations du store">
      <p className="mb-s-4 text-[13px] leading-6 text-ink-600">
        Ajoute une référence pour voir le <strong>Total HT</strong> s'animer
        en count-up dans le footer, et le rail droit se mettre à jour en live.
      </p>

      <div className="flex flex-wrap items-center gap-s-2">
        <button
          type="button"
          onClick={addNext}
          className="inline-flex h-9 items-center gap-s-2 rounded-r-2 bg-accent-500 px-s-4 text-[13px] font-semibold text-white shadow-1 transition-all duration-mid ease-out-soft hover:bg-accent-600 active:scale-[0.98]"
        >
          <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
          Ajouter une référence DTF
        </button>
        <button
          type="button"
          onClick={() => reset()}
          disabled={lines.length === 0}
          className="inline-flex h-9 items-center rounded-r-2 border border-ink-200 bg-white px-s-4 text-[13px] font-medium text-ink-600 transition-all duration-mid ease-out-soft hover:border-ink-300 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Réinitialiser
        </button>
      </div>

      {lines.length > 0 && (
        <ul className="mt-s-4 divide-y divide-ink-100 rounded-r-3 border border-ink-100">
          {lines.map((record) => (
            <li
              key={record.id}
              className="flex items-center gap-s-3 px-s-4 py-s-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink-800">
                  {isClassicLine(record.line)
                    ? record.line.produit || "—"
                    : "Textile"}
                </p>
                <p className="text-[11.5px] text-ink-500">
                  {isClassicLine(record.line) ? record.line.secteur : "—"}
                </p>
              </div>
              <div className="flex items-center gap-s-1">
                <QtyButton
                  label="−"
                  onClick={() => updateQty(record, -10)}
                  ariaLabel={`Retirer 10 unités de ${
                    isClassicLine(record.line) ? record.line.produit : ""
                  }`}
                />
                <span className="min-w-[3ch] text-center font-mono text-[13px] tabular-nums text-ink-800">
                  {isClassicLine(record.line) ? record.line.quantity : 0}
                </span>
                <QtyButton
                  label="+"
                  onClick={() => updateQty(record, +10)}
                  ariaLabel={`Ajouter 10 unités à ${
                    isClassicLine(record.line) ? record.line.produit : ""
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRecord(record.id)}
                aria-label="Supprimer cette référence"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-r-2 text-ink-400 transition-colors duration-mid ease-out-soft hover:bg-danger-100 hover:text-danger-500"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ZoneCard>
  );
}

function QtyButton({
  label,
  onClick,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-r-2 border border-ink-200 bg-white text-[15px] font-semibold text-ink-700 transition-all duration-mid ease-out-soft hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700 active:scale-95"
    >
      {label}
    </button>
  );
}

function ZoneCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-r-4 border border-ink-100 bg-white p-s-6 shadow-1">
      <h2 className="mb-s-3 text-[16px] font-semibold tracking-tight text-ink-800">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FillerLines({ count }: { count: number }) {
  return (
    <div className="space-y-s-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-r-1 bg-ink-50"
          style={{ width: `${60 + ((i * 13) % 35)}%` }}
        />
      ))}
    </div>
  );
}

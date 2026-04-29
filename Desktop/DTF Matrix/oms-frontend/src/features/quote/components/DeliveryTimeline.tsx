import { memo } from "react";
import {
  addBusinessDaysIso,
  computeDeliveryEstimate,
} from "@/features/new-order/constants/delivery";
import type { ProductCategoryId } from "@/features/new-order/constants";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TimelineStep {
  label: string;
  date: Date;
  status: "done" | "active" | "upcoming";
}

export type QuoteStage =
  | "saisie"
  | "envoi-bat"
  | "validation-client"
  | "production"
  | "livraison";

// ─── Internal constants ───────────────────────────────────────────────────────

interface StageDef {
  id: QuoteStage;
  label: string;
}

const STAGES: ReadonlyArray<StageDef> = [
  { id: "saisie",             label: "Saisie" },
  { id: "envoi-bat",          label: "Envoi BAT" },
  { id: "validation-client",  label: "Validation client" },
  { id: "production",         label: "Production" },
  { id: "livraison",          label: "Livraison" },
];

const FR_DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatStageDate(d: Date): string {
  return FR_DATE_FMT.format(d).replace(/\.$/, "");
}

// ─── Public helper ────────────────────────────────────────────────────────────

/**
 * Projette les 5 jalons globaux (Saisie → Livraison) à partir de `from`
 * (par défaut : aujourd'hui). Retourne un `TimelineStep[]` prêt à passer
 * à `<DeliveryTimeline steps={…} />`.
 *
 * Le calcul des délais est identique à celui de `ProcessTimeline` :
 *   - saisie           : J0
 *   - envoi-bat        : J0 + 1 jour ouvré
 *   - validation-client: J0 + 3 jours ouvrés
 *   - production       : validation + délai palier (catégorie × quantité)
 *   - livraison        : production + 1 jour ouvré
 */
export function buildDeliverySteps(
  current: QuoteStage = "saisie",
  categoryId: ProductCategoryId | null | undefined = null,
  totalQty = 0,
  from: Date = new Date(),
  isUrgent = false,
): TimelineStep[] {
  const currentIdx = STAGES.findIndex((s) => s.id === current);

  const origin = new Date(from);
  origin.setHours(12, 0, 0, 0);

  const envoiBatIso    = addBusinessDaysIso(origin, 1);
  const validationIso  = addBusinessDaysIso(origin, 3);
  const validationDate = parseIsoLocal(validationIso);

  const estimate     = computeDeliveryEstimate(categoryId ?? null, totalQty, isUrgent, validationDate);
  const productionEnd = parseIsoLocal(estimate.earliestIso);
  const livraisonIso  = addBusinessDaysIso(productionEnd, 1);

  const dates: Record<QuoteStage, Date> = {
    "saisie":             origin,
    "envoi-bat":          parseIsoLocal(envoiBatIso),
    "validation-client":  validationDate,
    "production":         productionEnd,
    "livraison":          parseIsoLocal(livraisonIso),
  };

  return STAGES.map((stage, i) => ({
    label: stage.label,
    date:  dates[stage.id],
    status: (
      i < currentIdx  ? "done"    :
      i === currentIdx ? "active"  :
                         "upcoming"
    ) as TimelineStep["status"],
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DeliveryTimelineProps {
  /** Exactement 5 entrées : Saisie → Envoi BAT → Validation client → Production → Livraison. */
  steps: TimelineStep[];
}

/**
 * Card « Planning prévisionnel » du rail droit.
 *
 * Reçoit un tableau `steps` pré-calculé (via `buildDeliverySteps`) — aucun
 * accès au store, aucune computation interne. Le composant est pur : même
 * props → même rendu.
 *
 * Accessibilité : `aria-current="step"` sur le jalon actif, icône hollow
 * (ring creux) pour les jalons à venir — distinguable en niveaux de gris.
 */
export const DeliveryTimeline = memo(function DeliveryTimeline({
  steps,
}: DeliveryTimelineProps) {
  return (
    <section
      aria-label="Planning prévisionnel"
      className="rounded-r-4 border border-ink-100 bg-white p-s-5 shadow-1"
    >
      <h3 className="mb-s-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        Planning prévisionnel
      </h3>

      <ol className="flex flex-col">
        {steps.map((step, i) => (
          <TimelineItem
            key={step.label}
            step={step}
            isLast={i === steps.length - 1}
          />
        ))}
      </ol>
    </section>
  );
});

// ─── TimelineItem ─────────────────────────────────────────────────────────────

interface TimelineItemProps {
  step: TimelineStep;
  isLast: boolean;
}

function TimelineItem({ step, isLast }: TimelineItemProps) {
  const { label, date, status } = step;

  // Ligne verticale continue via ::before.
  // Position : part du bas du dot (top-[11px]) jusqu'au bas du li (bottom-0),
  // ce qui assure une connexion pixel-perfect avec le dot de l'étape suivante.
  // Couleur : accent-500 plein (done), dégradé accent→ink-200 (active), ink-200 (upcoming).
  const lineClass = isLast ? "" :
    status === "active"
      ? "before:absolute before:left-[5px] before:top-[11px] before:bottom-0 before:w-px before:content-[''] before:bg-gradient-to-b before:from-accent-500 before:to-ink-200"
      : status === "done"
        ? "before:absolute before:left-[5px] before:top-[11px] before:bottom-0 before:w-px before:content-[''] before:bg-accent-500"
        : "before:absolute before:left-[5px] before:top-[11px] before:bottom-0 before:w-px before:content-[''] before:bg-ink-200";

  // Dot 11 px — `done` plein, `active` plein + halo, `upcoming` anneau creux.
  const dotClass =
    status === "done"
      ? "bg-accent-500"
      : status === "active"
        ? "bg-accent-500 ring-4 ring-accent-100"
        : "border-2 border-ink-300 bg-white";

  const labelClass =
    status === "upcoming"
      ? "text-[12.5px] font-medium text-ink-500"
      : "text-[12.5px] font-semibold text-ink-700";

  const dateClass =
    status === "active"  ? "text-ink-700"  :
    status === "done"    ? "text-ink-500"  :
                           "text-ink-400";

  return (
    <li
      className={`relative pl-s-7 ${isLast ? "" : "pb-s-5"} ${lineClass}`}
      aria-current={status === "active" ? "step" : undefined}
    >
      {/* Dot 11 px — centré sur la ligne (left-0, aligné avec before:left-[5px]) */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 h-[11px] w-[11px] rounded-full transition-all duration-mid ease-out-soft ${dotClass}`}
      />
      <div className="flex items-baseline justify-between gap-s-3">
        <span className={labelClass}>{label}</span>
        <time
          dateTime={date.toISOString().slice(0, 10)}
          className={`font-mono text-[11.5px] tabular-nums ${dateClass}`}
        >
          {formatStageDate(date)}
        </time>
      </div>
    </li>
  );
}

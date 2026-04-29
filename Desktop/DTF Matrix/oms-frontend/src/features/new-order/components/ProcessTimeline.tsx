import { memo, useMemo, useState } from "react";
import {
  addBusinessDaysIso,
  computeDeliveryEstimate,
} from "../constants/delivery";
import type { ProductCategoryId } from "../constants";
import { OPERATEURS } from "../constants";
import type { OperatorValue } from "../types";
import { Avatar } from "@/components/ui/Avatar";

export type ProcessStage =
  | "saisie"
  | "envoi-bat"
  | "validation-client"
  | "production"
  | "livraison";

interface StageDef {
  id: ProcessStage;
  label: string;
}

const STAGES: ReadonlyArray<StageDef> = [
  { id: "saisie", label: "Saisie" },
  { id: "envoi-bat", label: "Envoi BAT" },
  { id: "validation-client", label: "Validation client" },
  { id: "production", label: "Production" },
  { id: "livraison", label: "Livraison" },
];

interface Props {
  /** Étape courante (highlighted). Par défaut "saisie" pour une nouvelle commande. */
  current?: ProcessStage;
  /** Compact rendering pour le panel sticky. */
  compact?: boolean;
  /** Catégorie produit — alimente le calcul des délais réalistes. */
  categoryId?: ProductCategoryId | null;
  /** Quantité totale — applique les paliers (rallonge la production sur grosses séries). */
  totalQty?: number;
  /** Origine de la projection (pour les tests). Par défaut : aujourd'hui. */
  from?: Date;
  /** Opérateur assigné — affiché dans le popover si rempli. */
  assignedTo?: OperatorValue | "";
  /** Mode urgent — affecte le calcul de la timeline. */
  isUrgent?: boolean;
}

const STAGE_DEPENDENCIES: Record<ProcessStage, string | null> = {
  "saisie": null,
  "envoi-bat": null,
  "validation-client": "Nécessite : BAT envoyé",
  "production": "Nécessite : BAT validé client",
  "livraison": "Nécessite : Production terminée",
};

const FR_STAGE_DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

function parseIsoLocal(iso: string): Date {
  // ISO yyyy-mm-dd → date locale (midi pour éviter les bascules de fuseau).
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatStageDate(d: Date): string {
  // "lun. 27 avr." — équivalent natif de date-fns format("EEE dd MMM", { locale: fr }).
  return FR_STAGE_DATE.format(d).replace(/\.$/, "");
}

interface ProcessStageDef {
  id: ProcessStage;
  label: string;
}

interface ProcessStagePopoverProps {
  stage: ProcessStageDef;
  date: Date;
  operator: { value: OperatorValue; initial: string; name: string } | null;
  dependency: string | null;
}

function ProcessStagePopover({ stage, date, operator, dependency }: ProcessStagePopoverProps) {
  return (
    <div
      className="absolute left-[calc(100%+12px)] top-0 z-50 w-64 origin-left animate-in fade-in slide-in-from-left-2 duration-200 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.3)]"
      role="tooltip"
    >
      <div className="space-y-3">
        {/* Titre */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {stage.label}
          </h4>
        </div>

        {/* Date prévue */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-600">Date prévue</span>
          <time
            dateTime={date.toISOString().slice(0, 10)}
            className="text-[12px] font-semibold text-slate-900 tabular-nums"
          >
            {formatStageDate(date)}
          </time>
        </div>

        {/* Opérateur — uniquement s'il est défini */}
        {operator && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-600">Assigné à</span>
            <div className="flex items-center gap-1.5">
              <Avatar user={operator.value} size="xs" label={operator.name} />
              <span className="text-[12px] font-medium text-slate-900">{operator.name}</span>
            </div>
          </div>
        )}

        {/* Dépendance — uniquement si présente */}
        {dependency && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] text-slate-700">{dependency}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Projette les 5 jalons à partir de J0 :
 *  - saisie : J0
 *  - envoi-bat : J0 + 1 jour ouvré
 *  - validation-client : J0 + 3 jours ouvrés (24 h envoi + 48 h client)
 *  - production : validation + production min selon catégorie/quantité
 *  - livraison : production + 1 jour ouvré
 */
function computeStageDates(
  categoryId: ProductCategoryId | null | undefined,
  totalQty: number,
  from: Date,
  isUrgent: boolean = false,
): Record<ProcessStage, Date> {
  const saisie = new Date(from);
  saisie.setHours(12, 0, 0, 0);
  const batIso = addBusinessDaysIso(saisie, 1);
  const validationIso = addBusinessDaysIso(saisie, 3);
  const validationDate = parseIsoLocal(validationIso);
  const estimate = computeDeliveryEstimate(
    categoryId ?? null,
    totalQty,
    isUrgent,
    validationDate,
  );
  const productionEnd = parseIsoLocal(estimate.earliestIso);
  const livraisonIso = addBusinessDaysIso(productionEnd, 1);
  return {
    saisie,
    "envoi-bat": parseIsoLocal(batIso),
    "validation-client": parseIsoLocal(validationIso),
    production: productionEnd,
    livraison: parseIsoLocal(livraisonIso),
  };
}

/**
 * ProcessTimeline — visualise le workflow de la commande pour donner à
 * l'opérateur une vision immédiate de l'horizon engagé.
 */
export const ProcessTimeline = memo(function ProcessTimeline({
  current = "saisie",
  compact = false,
  categoryId = null,
  totalQty = 0,
  from,
  assignedTo = "",
  isUrgent = false,
}: Props) {
  const currentIdx = STAGES.findIndex((s) => s.id === current);
  const [selectedStage, setSelectedStage] = useState<ProcessStage | null>(null);
  const dates = useMemo(
    () => computeStageDates(categoryId, totalQty, from ?? new Date(), isUrgent),
    [categoryId, totalQty, from, isUrgent],
  );

  const operator = useMemo(() => {
    if (!assignedTo) return null;
    return OPERATEURS.find((op) => op.value === assignedTo) ?? null;
  }, [assignedTo]);

  if (compact) {
    return (
      <div className="space-y-[10px]" aria-label="Processus de commande">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          const isSelected = selectedStage === s.id;
          const dependency = STAGE_DEPENDENCIES[s.id];
          return (
            <div key={s.id} className="relative">
              <button
                type="button"
                onClick={() => setSelectedStage(isSelected ? null : s.id)}
                className={`w-full text-left relative flex items-center gap-3 rounded-lg px-3 py-2 transition cursor-pointer ${
                  isSelected ? "bg-slate-100" : "hover:bg-slate-100/60"
                }`}
              >
                {i < STAGES.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[15px] top-[32px] h-[14px] w-0.5 ${
                      isPast ? "bg-blue-500" : "bg-slate-200"
                    }`}
                  />
                )}

                <span
                  className={`relative z-10 flex-none rounded-full transition ${
                    isCurrent
                      ? "h-4 w-4 bg-blue-600 ring-4 ring-blue-200 shadow-[0_0_0_2px_white]"
                      : isPast
                        ? "h-3 w-3 bg-blue-500 ring-2 ring-blue-100"
                        : "h-3 w-3 bg-slate-300 ring-2 ring-slate-100"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                />

                <div className="flex-1 min-w-0">
                  <span
                    className={`block truncate text-[13px] tracking-tight ${
                      isCurrent
                        ? "font-bold text-blue-700"
                        : isPast
                          ? "font-semibold text-slate-700"
                          : "font-medium text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>

                <time
                  dateTime={dates[s.id].toISOString().slice(0, 10)}
                  className={`flex-none text-[12px] tabular-nums ${
                    isCurrent ? "font-semibold text-blue-600" : "text-slate-400"
                  }`}
                >
                  {formatStageDate(dates[s.id])}
                </time>
              </button>

              {isSelected && (
                <ProcessStagePopover
                  stage={s}
                  date={dates[s.id]}
                  operator={operator}
                  dependency={dependency}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full" aria-label="Processus de commande">
      <ol className="flex items-start justify-between gap-1 relative">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          const isSelected = selectedStage === s.id;
          const dependency = STAGE_DEPENDENCIES[s.id];
          return (
            <li
              key={s.id}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[7px] left-1/2 h-0.5 w-full ${
                    isPast ? "bg-blue-500" : "bg-slate-200"
                  }`}
                />
              )}

              <button
                type="button"
                onClick={() => setSelectedStage(isSelected ? null : s.id)}
                className={`relative z-10 flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full ring-4 transition cursor-pointer ${
                  isCurrent
                    ? "bg-blue-600 ring-blue-100"
                    : isPast
                      ? "bg-blue-500 ring-blue-50"
                      : "bg-slate-300 ring-slate-50"
                } ${isSelected ? "ring-blue-200" : ""}`}
                aria-pressed={isSelected}
              />

              <span
                className={`mt-2 w-full truncate text-center text-[10px] font-bold uppercase tracking-wider ${
                  isCurrent
                    ? "text-blue-700"
                    : isPast
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {s.label}
              </span>

              <time
                dateTime={dates[s.id].toISOString().slice(0, 10)}
                className={`mt-0.5 w-full truncate text-center text-[10px] font-medium tabular-nums ${
                  isCurrent ? "text-blue-600" : "text-slate-400"
                }`}
              >
                {formatStageDate(dates[s.id])}
              </time>

              {isSelected && (
                <ProcessStagePopover
                  stage={s}
                  date={dates[s.id]}
                  operator={operator}
                  dependency={dependency}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
});

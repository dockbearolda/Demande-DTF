import { memo } from "react";

export type ProcessStage =
  | "saisie"
  | "envoi-bat"
  | "validation-client"
  | "production"
  | "livraison";

interface StageDef {
  id: ProcessStage;
  label: string;
  /** Durée indicative en jours ouvrés (texte affiché sous l'étape). */
  duration: string;
}

const STAGES: StageDef[] = [
  { id: "saisie", label: "Saisie", duration: "en cours" },
  { id: "envoi-bat", label: "Envoi BAT", duration: "~24 h" },
  { id: "validation-client", label: "Validation client", duration: "~48 h" },
  { id: "production", label: "Production", duration: "~7 j" },
  { id: "livraison", label: "Livraison", duration: "~1 j" },
];

interface Props {
  /** Étape courante (highlighted). Par défaut "saisie" pour une nouvelle commande. */
  current?: ProcessStage;
  /** Compact rendering pour le panel sticky. */
  compact?: boolean;
}

/**
 * ProcessTimeline — visualise le workflow de la commande pour donner à
 * l'opérateur une vision immédiate de l'horizon engagé.
 */
export const ProcessTimeline = memo(function ProcessTimeline({
  current = "saisie",
  compact = false,
}: Props) {
  const currentIdx = STAGES.findIndex((s) => s.id === current);

  if (compact) {
    return (
      <ol className="flex flex-col gap-1.5" aria-label="Processus de commande">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <li key={s.id} className="relative flex items-center gap-2.5">
              {/* Vertical track to next stage */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[4.25px] top-[14px] h-[14px] w-0.5 ${
                    isPast ? "bg-blue-500" : "bg-slate-200"
                  }`}
                />
              )}

              {/* Dot */}
              <span
                className={`relative z-10 h-2.5 w-2.5 flex-none rounded-full ring-[3px] transition ${
                  isCurrent
                    ? "bg-blue-600 ring-blue-100"
                    : isPast
                      ? "bg-blue-500 ring-blue-50"
                      : "bg-slate-300 ring-slate-100"
                }`}
              />

              {/* Label */}
              <span
                className={`flex-1 truncate text-[10px] font-bold uppercase tracking-wider ${
                  isCurrent
                    ? "text-blue-700"
                    : isPast
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {s.label}
              </span>

              {/* Duration */}
              <span
                className={`flex-none text-[10px] font-medium tabular-nums ${
                  isCurrent ? "text-blue-600" : "text-slate-400"
                }`}
              >
                {s.duration}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="w-full" aria-label="Processus de commande">
      <ol className="flex items-start justify-between gap-1">
        {STAGES.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <li
              key={s.id}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {/* Track to next stage */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[7px] left-1/2 h-0.5 w-full ${
                    isPast ? "bg-blue-500" : "bg-slate-200"
                  }`}
                />
              )}

              {/* Dot */}
              <span
                className={`relative z-10 flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full ring-4 transition ${
                  isCurrent
                    ? "bg-blue-600 ring-blue-100"
                    : isPast
                      ? "bg-blue-500 ring-blue-50"
                      : "bg-slate-300 ring-slate-50"
                }`}
              />

              {/* Label */}
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

              {/* Duration */}
              <span
                className={`mt-0.5 w-full truncate text-center text-[10px] font-medium ${
                  isCurrent ? "text-blue-600" : "text-slate-400"
                }`}
              >
                {s.duration}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
});

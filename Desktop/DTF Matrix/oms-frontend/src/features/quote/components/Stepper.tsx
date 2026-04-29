import { Check } from "lucide-react";
import { Fragment } from "react";

export type StepState = "idle" | "active" | "done";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index 0-based de l'étape courante (active). Les étapes < currentIndex
   *  sont marquées `done`, > currentIndex sont `idle`. */
  currentIndex: number;
  className?: string;
  /** Permet de cliquer sur une étape déjà franchie pour y revenir. */
  onStepClick?: (index: number, step: StepperStep) => void;
}

/**
 * Stepper compact pour header sticky : un cercle 24px par étape, relié par
 * un trait fin. Trois états : `idle` (gris), `active` (rempli accent),
 * `done` (rempli avec ✓). Cliquable uniquement sur les étapes `done` quand
 * `onStepClick` est fourni.
 */
export function Stepper({
  steps,
  currentIndex,
  className,
  onStepClick,
}: StepperProps) {
  return (
    <ol
      role="list"
      aria-label="Progression du devis"
      className={`flex items-center gap-s-2 ${className ?? ""}`}
    >
      {steps.map((step, i) => {
        const state: StepState =
          i < currentIndex ? "done" : i === currentIndex ? "active" : "idle";
        const clickable = state === "done" && Boolean(onStepClick);
        return (
          <Fragment key={step.id}>
            <li className="flex items-center gap-s-2">
              <StepDot
                index={i + 1}
                state={state}
                label={step.label}
                clickable={clickable}
                onClick={
                  clickable ? () => onStepClick?.(i, step) : undefined
                }
              />
              <span
                className={`hidden text-[12px] font-medium transition-colors duration-mid ease-out-soft md:inline ${
                  state === "active"
                    ? "text-ink-800"
                    : state === "done"
                      ? "text-ink-600"
                      : "text-ink-400"
                }`}
              >
                {step.label}
              </span>
            </li>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-px w-s-6 transition-colors duration-mid ease-out-soft ${
                  i < currentIndex ? "bg-accent-500" : "bg-ink-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

interface StepDotProps {
  index: number;
  state: StepState;
  label: string;
  clickable: boolean;
  onClick?: () => void;
}

function StepDot({ index, state, label, clickable, onClick }: StepDotProps) {
  const base =
    "flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-mid ease-out-soft";

  const stateClass =
    state === "active"
      ? "bg-accent-500 text-white shadow-1 ring-2 ring-accent-100"
      : state === "done"
        ? "bg-accent-500 text-white"
        : "bg-ink-100 text-ink-500";

  const clickableClass = clickable
    ? "cursor-pointer hover:scale-105 active:scale-95"
    : "";

  const ariaCurrent = state === "active" ? "step" : undefined;
  const ariaLabel = `Étape ${index} : ${label}${
    state === "done" ? " (terminée)" : state === "active" ? " (en cours)" : ""
  }`;

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        className={`${base} ${stateClass} ${clickableClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2`}
      >
        {state === "done" ? (
          <Check size={12} strokeWidth={2.5} aria-hidden="true" />
        ) : (
          index
        )}
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      className={`${base} ${stateClass}`}
    >
      {state === "done" ? (
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        index
      )}
    </span>
  );
}

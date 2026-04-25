import { memo, useMemo } from "react";
import {
  selectLine,
  selectStep,
  useNewOrderStore,
  type WizardStep,
} from "../store";
import { isTextileLine } from "../types";

interface StepDef {
  id: WizardStep;
  label: string;
  description: string;
}

const STEPS: StepDef[] = [
  { id: 1, label: "Produit", description: "Catégorie et tailles" },
  { id: 2, label: "Personnalisation", description: "Logo et BAT" },
  { id: 3, label: "Livraison", description: "Client et infos" },
];

interface Props {
  /** Per-step content rendered by the parent. */
  step1: React.ReactNode;
  step2: React.ReactNode;
  step3: React.ReactNode;
  /** Called when user requests step navigation (Next button). Should return true to allow. */
  onRequestNext: () => boolean;
  /** Called when user clicks final CTA on Step 3. */
  onSubmitFinal: () => void;
  /** Submitting flag from the parent (disables nav). */
  submitting?: boolean;
}

/**
 * FormWizard — 3-step wrapper with progress bar + per-step navigation.
 *
 * Holds the visible step layout but delegates step content + validation to
 * the parent component. State (currentStep, formData) lives in the store and
 * is persisted to localStorage automatically.
 */
export const FormWizard = memo(function FormWizard({
  step1,
  step2,
  step3,
  onRequestNext,
  onSubmitFinal,
  submitting,
}: Props) {
  const currentStep = useNewOrderStore(selectStep);
  const goPrev = useNewOrderStore((s) => s.goPrevStep);
  const setStep = useNewOrderStore((s) => s.setStep);
  const line = useNewOrderStore(selectLine);

  // Step 2 may be skipped for non-textile orders, but we keep all 3 visible
  // for design consistency and only show "no customization" placeholder.
  const isTextile = !!line && isTextileLine(line);

  const completion = useMemo(() => {
    return Math.round((currentStep / 3) * 100);
  }, [currentStep]);

  const isLastStep = currentStep === 3;

  return (
    <div className="space-y-5">
      <ProgressBar
        currentStep={currentStep}
        completion={completion}
        onJump={(target) => {
          // Allow jumping back, but forward only via Next (to enforce validation)
          if (target <= currentStep) setStep(target);
        }}
      />

      <div
        key={currentStep}
        className="animate-in fade-in slide-in-from-right-1 duration-200"
      >
        {currentStep === 1 && step1}
        {currentStep === 2 &&
          (isTextile ? (
            step2
          ) : (
            <NoCustomization />
          ))}
        {currentStep === 3 && step3}
      </div>

      <NavigationBar
        currentStep={currentStep}
        isLastStep={isLastStep}
        submitting={submitting}
        onPrev={goPrev}
        onNext={() => {
          if (onRequestNext()) {
            // parent caller will move step itself if validation passes
          }
        }}
        onSubmit={onSubmitFinal}
      />
    </div>
  );
});

// ───────── ProgressBar ─────────

function ProgressBar({
  currentStep,
  completion,
  onJump,
}: {
  currentStep: WizardStep;
  completion: number;
  onJump: (step: WizardStep) => void;
}) {
  return (
    <div>
      {/* Pastilles row */}
      <div className="relative flex items-center justify-between">
        {/* Track */}
        <div className="absolute left-5 right-5 top-5 h-0.5 -translate-y-1/2 bg-slate-200" />
        <div
          className="absolute left-5 top-5 h-0.5 -translate-y-1/2 bg-blue-600 transition-all duration-300"
          style={{
            width: `calc(${((currentStep - 1) / (STEPS.length - 1)) * 100}% - ${
              currentStep === 1 ? 0 : 0
            }px)`,
            maxWidth: "calc(100% - 40px)",
          }}
        />

        {STEPS.map((s) => {
          const completed = s.id < currentStep;
          const active = s.id === currentStep;
          const clickable = s.id <= currentStep;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => clickable && onJump(s.id)}
              disabled={!clickable}
              className={`relative z-10 flex flex-col items-center gap-1.5 transition ${
                clickable ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-4 transition-all duration-200 ${
                  completed
                    ? "bg-blue-600 text-white ring-blue-100"
                    : active
                      ? "bg-white text-blue-700 ring-blue-200 shadow-sm border-2 border-blue-600"
                      : "bg-white text-slate-400 ring-slate-100 border border-slate-200"
                }`}
              >
                {completed ? <CheckIcon className="h-5 w-5" /> : s.id}
              </span>
              <div className="text-center">
                <div
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    active
                      ? "text-blue-700"
                      : completed
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {s.label}
                </div>
                <div className="hidden text-[10px] font-medium text-slate-400 sm:block">
                  {s.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* % completion */}
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-500">
          Étape {currentStep} sur {STEPS.length}
        </span>
        <span className="font-bold text-blue-700 tabular-nums">{completion}%</span>
      </div>
    </div>
  );
}

// ───────── NavigationBar ─────────

function NavigationBar({
  currentStep,
  isLastStep,
  submitting,
  onPrev,
  onNext,
  onSubmit,
}: {
  currentStep: WizardStep;
  isLastStep: boolean;
  submitting?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const nextLabels: Record<WizardStep, string> = {
    1: "Continuer vers la personnalisation",
    2: "Continuer vers la livraison",
    3: "Créer la commande",
  };

  return (
    <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 px-6 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentStep === 1 || submitting}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
        Précédent
      </button>

      <button
        type="button"
        onClick={isLastStep ? onSubmit : onNext}
        disabled={submitting}
        title={
          isLastStep
            ? "Après validation, le BAT part en production automatiquement si non contesté sous 48 h"
            : undefined
        }
        className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold shadow-sm transition disabled:opacity-60 sm:flex-initial ${
          isLastStep
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {submitting ? (
          <>
            <Spinner className="h-4 w-4" />
            Traitement…
          </>
        ) : (
          <>
            {nextLabels[currentStep]}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </>
        )}
      </button>
    </div>
  );
}

// ───────── No customization placeholder ─────────

function NoCustomization() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <SparkIcon className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-slate-700">
        Aucune personnalisation requise
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Ce produit ne nécessite ni placement de logo ni création de BAT.<br />
        Continue vers la livraison.
      </p>
    </div>
  );
}

// ───────── Icons ─────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

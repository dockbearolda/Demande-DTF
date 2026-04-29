import { memo } from "react";
import {
  selectLines,
  selectStep,
  useNewOrderStore,
  type WizardStep,
} from "../store";
import { isTextileLine } from "../types";
import { QuoteStickyFooter } from "./QuoteStickyFooter";
import { StepIntro } from "./StepIntro";

interface Props {
  /** Per-step content rendered by the parent. */
  step1: React.ReactNode;
  step2: React.ReactNode;
  step3: React.ReactNode;
  step4: React.ReactNode;
  /** Called when user requests step navigation (Next button). Should return true to allow. */
  onRequestNext: () => boolean;
  /** Called when user clicks final CTA on Step 4. */
  onSubmitFinal: () => void;
  /** Submitting flag from the parent (disables nav). */
  submitting?: boolean;
}

/**
 * FormWizard — 4-step wrapper with progress bar + per-step navigation.
 *
 * Order of steps: Client → Articles → Personnalisation → Livraison.
 * Holds the visible step layout but delegates step content + validation to
 * the parent component. State (currentStep, formData) lives in the store and
 * is persisted to localStorage automatically.
 */
export const FormWizard = memo(function FormWizard({
  step1,
  step2,
  step3,
  step4,
  onRequestNext,
  onSubmitFinal,
  submitting,
}: Props) {
  const currentStep = useNewOrderStore(selectStep);
  const goPrev = useNewOrderStore((s) => s.goPrevStep);
  const lines = useNewOrderStore(selectLines);

  // Personnalisation peut être skippée pour les commandes non-textile, mais on
  // garde l'étape visible pour la cohérence visuelle. Multi-références :
  // affichée dès qu'au moins une ligne textile existe (peu importe laquelle
  // est dépliée dans l'accordéon).
  const isTextile = lines.some((r) => isTextileLine(r.line));

  const isLastStep = currentStep === 4;
  // L'étape Articles (2) utilise le QuoteStickyFooter qui affiche les totaux.
  const isArticlesStep = currentStep === 2;

  return (
    <div className="space-y-5">
      <StepIntro step={currentStep} />

      <div
        key={currentStep}
        className="animate-in fade-in slide-in-from-right-1 duration-200"
      >
        {currentStep === 1 && step1}
        {currentStep === 2 && step2}
        {currentStep === 3 &&
          (isTextile ? (
            step3
          ) : (
            <NoCustomization />
          ))}
        {currentStep === 4 && step4}
      </div>

      {isArticlesStep ? (
        <QuoteStickyFooter
          onContinue={() => { onRequestNext(); }}
          submitting={submitting}
        />
      ) : (
        <NavigationBar
          currentStep={currentStep}
          isLastStep={isLastStep}
          submitting={submitting}
          onPrev={goPrev}
          onNext={() => { onRequestNext(); }}
          onSubmit={onSubmitFinal}
        />
      )}
    </div>
  );
});

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
  const ctaLabel = isLastStep
    ? "Créer la commande"
    : currentStep === 1
      ? "Continuer · Articles →"
      : currentStep === 3
        ? "Continuer · Livraison →"
        : "Étape suivante";

  return (
    <div className="sticky bottom-0 -mx-6 mt-6 flex items-center gap-3 border-t border-slate-200 bg-slate-50/95 px-6 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
      {currentStep > 1 && (
        <button
          type="button"
          onClick={onPrev}
          disabled={submitting}
          aria-label="Étape précédente"
          className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        onClick={isLastStep ? onSubmit : onNext}
        disabled={submitting}
        title={
          isLastStep
            ? "Après validation, le BAT part en production automatiquement si non contesté sous 48 h"
            : undefined
        }
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#4A6274] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a4e5d] disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Spinner className="h-4 w-4" />
            Traitement…
          </>
        ) : (
          <>
            {ctaLabel}
            <ChevronRight className="h-4 w-4" />
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


import { memo } from "react";
import { selectStep, useNewOrderStore, type WizardStep } from "../store";
import { getQuoteId } from "../quoteId";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: "Client" },
  { id: 2, label: "Articles" },
  { id: 3, label: "Personnalisation" },
  { id: 4, label: "Livraison" },
];

interface Props {
  categoryLabel?: string | null;
  onCancel?: () => void;
}

export const QuoteHeader = memo(function QuoteHeader({ categoryLabel, onCancel }: Props) {
  const currentStep = useNewOrderStore(selectStep);
  const setStep = useNewOrderStore((s) => s.setStep);

  const suffix = categoryLabel ? ` · ${categoryLabel}` : "";

  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      {/* Left: ID + titre + annuler */}
      <div className="min-w-0">
        <p
          className="font-medium uppercase text-ink-400"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}
        >
          {getQuoteId()}{suffix}
        </p>
        <div className="mt-0.5 flex items-baseline gap-3 flex-wrap">
          <h2
            className="text-ink-900"
            style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}
          >
            Nouvelle demande
          </h2>
          <SaveStatusIndicator />
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-medium text-ink-400 hover:text-ink-700 transition-colors"
              style={{ fontSize: 11, fontFamily: "var(--font-text)" }}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Right: stepper pills */}
      <nav aria-label="Étapes du formulaire" className="flex shrink-0 items-center gap-1">
        {STEPS.map((s) => {
          const completed = s.id < currentStep;
          const active = s.id === currentStep;
          return (
            <button
              key={s.id}
              type="button"
              onClick={completed ? () => setStep(s.id) : undefined}
              disabled={!completed && !active}
              aria-current={active ? "step" : undefined}
              style={{
                height: 28,
                borderRadius: "var(--r-pill)",
                padding: "0 10px",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-text)",
                border: "none",
                transition: "background var(--dur-base), color var(--dur-base)",
                backgroundColor: active
                  ? "var(--accent-500)"
                  : completed
                    ? "var(--ink-100)"
                    : "var(--ink-50)",
                color: active ? "#fff" : completed ? "var(--ink-700)" : "var(--ink-400)",
                cursor: completed ? "pointer" : "default",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 700,
                  backgroundColor: active
                    ? "rgba(255,255,255,0.22)"
                    : completed
                      ? "var(--accent-500)"
                      : "var(--ink-200)",
                  color: active ? "#fff" : completed ? "#fff" : "var(--ink-400)",
                }}
              >
                {completed ? "✓" : s.id}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

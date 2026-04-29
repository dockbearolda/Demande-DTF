import type { ReactNode } from "react";
import { QuoteIdentity, type QuoteIdentityProps } from "./QuoteIdentity";
import { Stepper, type StepperStep } from "./Stepper";
import { SecondaryActions } from "./SecondaryActions";

export interface QuoteLayoutProps {
  /** Identité du devis affichée à gauche du header (référence + catégorie). */
  identity: QuoteIdentityProps;
  /** Étapes du tunnel devis affichées dans le stepper du header. */
  steps: StepperStep[];
  /** Index 0-based de l'étape courante. */
  currentStepIndex: number;
  /** Slot principal — contenu de saisie, scrolle dans la colonne centrale. */
  children: ReactNode;
  /** Slot rail droit — résumé devis, processus, etc. Reste sticky sous le header. */
  summary: ReactNode;
  /** Slot footer sticky — total live + CTA principal. */
  footer: ReactNode;
  /** Brand mark / logo optionnel à gauche extrême du header (avant l'identité). */
  brand?: ReactNode;
  /** Callbacks header secondaire. */
  onPrint?: () => void;
  onCancel?: () => void;
  disablePrint?: boolean;
  /** Permet de revenir à une étape franchie en cliquant son cercle. */
  onStepClick?: (index: number, step: StepperStep) => void;
}

/**
 * Shell du tunnel « Devis Rapide » — étape 3 de l'audit refonte.
 *
 *  ┌─ header sticky 64px (brand · identité · stepper · actions) ─────────┐
 *  ├─ body grid-cols-12 ──────────────────────────────────────────────────┤
 *  │   main col-span-8         │   aside col-span-4 (sticky top-24)        │
 *  │   ↳ children (scrollable) │   ↳ summary (rail)                        │
 *  └─ footer sticky 80px (total live + CTA principal) ──────────────────┘
 *
 * Header et footer utilisent `backdrop-blur` pour l'effet glass premium.
 * Le rail reste collé sous le header via `sticky top-[80px]` (= 64px header
 * + 16px gap). Le main a un `pb-24` pour ne jamais passer sous le footer fixe.
 */
export function QuoteLayout({
  identity,
  steps,
  currentStepIndex,
  children,
  summary,
  footer,
  brand,
  onPrint,
  onCancel,
  disablePrint,
  onStepClick,
}: QuoteLayoutProps) {
  return (
    <div
      className="quote-layout-scroll relative h-[100dvh] overflow-y-auto overflow-x-hidden bg-ink-25 font-text text-ink-900"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* ── HEADER STICKY : brand + identité + stepper + actions ───── */}
      <header
        className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur-md backdrop-saturate-150"
        style={{ WebkitBackdropFilter: "blur(12px) saturate(150%)" }}
      >
        <div className="mx-auto flex h-16 max-w-quote items-center gap-s-6 px-s-8">
          {brand && <div className="flex-none">{brand}</div>}
          <QuoteIdentity {...identity} />
          <Stepper
            steps={steps}
            currentIndex={currentStepIndex}
            onStepClick={onStepClick}
            className="ml-auto"
          />
          <SecondaryActions
            onPrint={onPrint}
            onCancel={onCancel}
            disablePrint={disablePrint}
          />
        </div>
      </header>

      {/* ── BODY : grille 12 cols, main 8 / aside 4 ───────────────── */}
      <div className="mx-auto grid max-w-quote grid-cols-12 gap-s-6 px-s-8 py-s-8">
        <main className="col-span-12 flex flex-col gap-s-6 pb-s-20 lg:col-span-8">
          {children}
        </main>
        <aside
          className="col-span-12 self-start lg:col-span-4 lg:sticky lg:top-[80px]"
          aria-label="Résumé du devis"
        >
          <div className="space-y-s-3">{summary}</div>
        </aside>
      </div>

      {/* ── FOOTER STICKY : total + CTA principal ─────────────────── */}
      <footer
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 backdrop-blur-md backdrop-saturate-150"
        style={{ WebkitBackdropFilter: "blur(12px) saturate(150%)" }}
      >
        <div className="mx-auto flex h-20 max-w-quote items-center gap-s-6 px-s-8">
          {footer}
        </div>
      </footer>
    </div>
  );
}

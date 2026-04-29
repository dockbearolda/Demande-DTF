import { memo } from "react";
import type { WizardStep } from "../store";

const META: Record<WizardStep, { eyebrow: string; title: string; subtitle: string }> = {
  1: {
    eyebrow: "Étape 1 sur 4",
    title: "Client",
    subtitle: "Sélectionnez le client et l'opérateur assigné à cette commande.",
  },
  2: {
    eyebrow: "Étape 2 sur 4",
    title: "Définir vos articles",
    subtitle: "Sélectionnez les produits, couleurs et quantités à commander.",
  },
  3: {
    eyebrow: "Étape 3 sur 4",
    title: "Personnalisation",
    subtitle: "Définissez les placements de logo et générez les BAT par référence.",
  },
  4: {
    eyebrow: "Étape 4 sur 4",
    title: "Livraison",
    subtitle: "Renseignez la date de livraison souhaitée et les éventuelles consignes.",
  },
};

export const StepIntro = memo(function StepIntro({ step }: { step: WizardStep }) {
  const meta = META[step];
  return (
    <div className="mb-5 border-b border-ink-100 pb-4">
      <h3
        id={`step-intro-${step}`}
        className="text-ink-800"
        style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}
      >
        {meta.title}
      </h3>
    </div>
  );
});

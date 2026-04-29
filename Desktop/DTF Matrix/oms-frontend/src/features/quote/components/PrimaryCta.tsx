import { memo, type ReactNode } from "react";
import { useQuoteStore } from "../store/useQuoteStore";

interface PrimaryCtaProps {
  /** Libellé du bouton. */
  label: string;
  /** Action déclenchée au clic. */
  onClick?: () => void;
  /** Désactive en plus de la règle « 0 article » (ex: pendant un submit). */
  disabled?: boolean;
  /** Icône optionnelle, alignée à droite du libellé. */
  icon?: ReactNode;
  /** Override du message expliquant pourquoi le CTA est désactivé. */
  disabledReason?: string;
}

const DEFAULT_DISABLED_REASON = "Ajoutez au moins une référence pour continuer";

/**
 * CTA principal du footer. Désactivé tant qu'aucune référence n'a de
 * quantité saisie, avec un tooltip natif (`title=`) qui explique pourquoi
 * — un bouton grisé sans explication est l'une des friction UX les plus
 * coûteuses dans un tunnel de saisie.
 *
 * `aria-disabled` est utilisé en complément de `disabled` pour conserver le
 * focus clavier sur le bouton (= le tooltip reste accessible aux utilisateurs
 * qui naviguent au clavier).
 */
export const PrimaryCta = memo(function PrimaryCta({
  label,
  onClick,
  disabled,
  icon,
  disabledReason = DEFAULT_DISABLED_REASON,
}: PrimaryCtaProps) {
  const { totalUnits } = useQuoteStore();
  const blockedByEmptyQuote = totalUnits <= 0;
  const isDisabled = disabled || blockedByEmptyQuote;

  const reason = blockedByEmptyQuote ? disabledReason : undefined;

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      aria-disabled={isDisabled || undefined}
      title={reason}
      className={`ml-auto inline-flex h-11 items-center gap-s-2 rounded-r-3 px-s-6 text-[14px] font-semibold transition-all duration-mid ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
        isDisabled
          ? "cursor-not-allowed bg-ink-200 text-ink-500"
          : "bg-accent-500 text-white shadow-1 hover:bg-accent-600 active:scale-[0.98]"
      }`}
    >
      <span>{label}</span>
      {icon && <span aria-hidden="true">{icon}</span>}
    </button>
  );
});

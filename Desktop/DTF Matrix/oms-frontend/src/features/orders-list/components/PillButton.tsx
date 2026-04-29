import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  active?: boolean;
  /** Pastille compteur, surfacée seulement si > 0. */
  count?: number;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Bouton de filtre — chrome unifié : pill, légère élévation au survol,
 * indication active duck-blue subtil. Compatible avec un usage de toggle
 * (urgent) ou de déclencheur popover (statut, secteur…).
 */
export const PillButton = forwardRef<HTMLButtonElement, Props>(function PillButton(
  { active = false, count, icon, children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        border: "1px solid",
        borderColor: active ? "var(--brand-duck-300)" : "var(--brand-sage-100)",
        background: active ? "rgba(107,129,145,0.10)" : "var(--brand-paper-hi)",
        color: active ? "var(--fg-1)" : "var(--fg-2)",
        cursor: "default",
        transition:
          "background-color 160ms var(--ease-snap), border-color 160ms var(--ease-snap), color 160ms var(--ease-snap)",
        ...style,
      }}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
      {typeof count === "number" && count > 0 && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            background: active ? "var(--brand-duck-500)" : "var(--brand-sage-100)",
            color: active ? "var(--fg-on-primary)" : "var(--fg-2)",
            fontSize: 10.5,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            marginLeft: 2,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
});

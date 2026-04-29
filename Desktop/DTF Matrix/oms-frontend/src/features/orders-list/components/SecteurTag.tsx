import { SECTEUR_LABELS, type Secteur } from "@/lib/types";

interface Props {
  /** `null` ou ≥ 2 secteurs ⇒ rendu "Mixte". */
  secteurs: Secteur[];
  size?: "sm" | "md";
}

/**
 * Tag parchemin warm — fond linen, texte fg-2 ; ne sort jamais des
 * tokens DS. Quand une commande couvre plusieurs secteurs on rend
 * "Mixte" avec le compteur en exposant.
 */
export function SecteurTag({ secteurs, size = "md" }: Props) {
  const isMixte = secteurs.length > 1;
  const label = isMixte ? "Mixte" : secteurs[0] ? SECTEUR_LABELS[secteurs[0]] : "—";
  const count = isMixte ? secteurs.length : 0;

  const padY = size === "sm" ? "2px" : "3px";
  const padX = size === "sm" ? "7px" : "9px";
  const fs = size === "sm" ? 10.5 : 11.5;

  return (
    <span
      title={isMixte ? secteurs.map((s) => SECTEUR_LABELS[s]).join(" · ") : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--brand-linen)",
        color: "var(--fg-2)",
        border: "1px solid rgba(74,98,116,0.10)",
        borderRadius: 5,
        padding: `${padY} ${padX}`,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontSize: fs - 2,
            fontWeight: 700,
            color: "var(--fg-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ×{count}
        </span>
      )}
    </span>
  );
}

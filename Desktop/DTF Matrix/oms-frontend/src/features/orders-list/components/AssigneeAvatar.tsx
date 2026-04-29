import type { AssignedTo } from "@/lib/types";

const NAMES: Record<AssignedTo, string> = {
  L: "Loïc",
  C: "Charlie",
  M: "Mélina",
};

interface Props {
  value: AssignedTo | null;
  size?: number;
  /** Si `true`, rend l'avatar en outline pour signaler "à toi" sans assignation. */
  ghost?: boolean;
}

/**
 * Avatar mono-opérateur — slate monochrome, conforme DS. Pas de gradient
 * coloré : la lisibilité prime à 60px de colonne.
 */
export function AssigneeAvatar({ value, size = 22, ghost = false }: Props) {
  if (!value) {
    return (
      <span
        title="Non assigné"
        aria-label="Non assigné"
        style={{
          display: "inline-flex",
          width: size,
          height: size,
          borderRadius: "50%",
          background: "transparent",
          border: "1px dashed var(--brand-sage-100)",
          color: "var(--fg-4)",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(size * 0.45),
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        —
      </span>
    );
  }
  return (
    <span
      title={NAMES[value]}
      aria-label={NAMES[value]}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: "50%",
        background: ghost ? "transparent" : "var(--fg-2)",
        border: ghost ? "1px solid var(--fg-2)" : "none",
        color: ghost ? "var(--fg-2)" : "var(--fg-on-primary)",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.45),
        fontWeight: 700,
        letterSpacing: 0,
        flexShrink: 0,
      }}
    >
      {value}
    </span>
  );
}

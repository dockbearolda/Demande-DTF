import { ALL_PLACEMENTS, type LogoPlacement } from "@/features/pricing";
import { placementLabel } from "../format";

interface Props {
  active: Set<LogoPlacement>;
  onToggle: (p: LogoPlacement) => void;
  disabled?: boolean;
}

/** Les 6 chips toggle d'emplacements logos, dans l'ordre canonique. */
export function PlacementChips({ active, onToggle, disabled }: Props) {
  return (
    <div
      role="group"
      aria-label="Emplacements logos"
      style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
    >
      {ALL_PLACEMENTS.map((p) => {
        const isActive = active.has(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            disabled={disabled}
            aria-pressed={isActive}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${
                isActive ? "var(--brand-duck-500)" : "rgba(74,98,116,0.18)"
              }`,
              background: isActive ? "var(--brand-duck-500)" : "#fff",
              color: isActive ? "var(--fg-on-primary)" : "var(--fg-2)",
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              letterSpacing: "-0.005em",
              transition: "all 120ms ease",
            }}
          >
            {placementLabel(p)}
          </button>
        );
      })}
    </div>
  );
}

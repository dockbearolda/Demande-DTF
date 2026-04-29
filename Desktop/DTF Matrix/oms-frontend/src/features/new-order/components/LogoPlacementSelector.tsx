import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlacementId =
  | "front-center"
  | "front-pocket"
  | "sleeve-left"
  | "sleeve-right"
  | "back-center"
  | "back-upper";

// Backward-compat aliases — still consumed by ProductPreview and pricing
export type BodyPlacement = "front" | "back";
export type SleevePlacement = "sleeve-left" | "sleeve-right";
export type LogoPlacement = BodyPlacement;
export type SvgZone = "front" | "back" | "sleeve-l" | "sleeve-r";

// ─── Placement definitions ────────────────────────────────────────────────────

type PlacementDef = {
  id: PlacementId;
  label: string;
  svgType: "front" | "back" | "sleeve-left" | "sleeve-right";
  rect: { x: number; y: number; w: number; h: number; rx: number };
};

const PLACEMENT_DEFS: readonly PlacementDef[] = [
  { id: "sleeve-left",   label: "Manche gauche",  svgType: "sleeve-left",  rect: { x: 17, y: 24, w: 10, h:  5, rx: 1   } },
  { id: "front-center",  label: "Avant",          svgType: "front",        rect: { x: 33, y: 36, w: 14, h: 18, rx: 1.5 } },
  { id: "back-center",   label: "Dos",            svgType: "back",         rect: { x: 28, y: 36, w: 22, h: 18, rx: 1.5 } },
  { id: "sleeve-right",  label: "Manche droite",  svgType: "sleeve-right", rect: { x: 53, y: 24, w: 10, h:  5, rx: 1   } },
] as const;

const SVG_PATHS: Record<PlacementDef["svgType"], string> = {
  "front":
    "M20 18 L30 12 C32 16, 36 18, 40 18 C44 18, 48 16, 50 12 L60 18 L66 26 L60 30 L58 32 L58 66 C58 67.5, 56.5 69, 55 69 L25 69 C23.5 69, 22 67.5, 22 66 L22 32 L20 30 L14 26 Z",
  "back":
    "M16 18 L27 12 L31 16 C34 17, 46 17, 49 16 L53 12 L64 18 L70 26 L64 30 L62 32 L62 66 C62 67.5, 60.5 69, 59 69 L21 69 C19.5 69, 18 67.5, 18 66 L18 32 L16 30 L10 26 Z",
  "sleeve-left":
    "M32 18 L36 18 C38 22, 42 22, 44 18 L48 18 L48 68 C48 68.5, 47.5 69, 47 69 L33 69 C32.5 69, 32 68.5, 32 68 L32 32 L18 32 L14 28 L18 22 L32 22 Z",
  "sleeve-right":
    "M48 18 L44 18 C42 22, 38 22, 36 18 L32 18 L32 68 C32 68.5, 32.5 69, 33 69 L47 69 C47.5 69, 48 68.5, 48 68 L48 32 L62 32 L66 28 L62 22 L48 22 Z",
};

// ─── Placement icon ───────────────────────────────────────────────────────────

function PlacementIcon({ def }: { def: PlacementDef }) {
  const { x, y, w, h, rx } = def.rect;
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className="h-full w-full"
    >
      <path
        d={SVG_PATHS[def.svgType]}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
    </svg>
  );
}

// ─── PlacementButton ──────────────────────────────────────────────────────────

function PlacementButton({
  def,
  selected,
  onSelect,
}: {
  def: PlacementDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showTooltip = hovered;

  return (
    <div className="relative">
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={def.label}
        onClick={onSelect}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className={[
          "relative flex aspect-square w-full min-w-[44px] min-h-[44px] items-center justify-center rounded-xl",
          "transition-all duration-150 focus:outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111827]",
          selected
            ? "border-[1.5px] border-[#111827] bg-[#F9FAFB]"
            : "border border-[#E5E7EB] bg-transparent hover:border-[1.5px] hover:border-[#111827] hover:bg-[#F9FAFB]",
        ].join(" ")}
      >
        <span className="sr-only">{def.label}</span>

        {/* Icon — 60% of card */}
        <span
          className="flex h-[60%] w-[60%] items-center justify-center transition-colors duration-150"
          style={{ color: selected || hovered ? "#111827" : "#6B7280" }}
        >
          <PlacementIcon def={def} />
        </span>

        {/* Check badge */}
        {selected && (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#111827]"
          >
            <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="h-2.5 w-2.5">
              <polyline
                points="2,6.5 4.5,9 10,3"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
      </button>

      {/* Tooltip */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2",
          "whitespace-nowrap rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-[3px]",
          "text-[11px] text-[#111827] shadow-sm",
          "transition-opacity duration-150",
          showTooltip ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {def.label}
      </div>
    </div>
  );
}

// ─── PlacementSelector ────────────────────────────────────────────────────────

export interface PlacementSelectorProps {
  selected: PlacementId[];
  onToggle: (id: PlacementId) => void;
  className?: string;
}

export function PlacementSelector({ selected, onToggle, className }: PlacementSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Emplacements d'impression (sélection multiple)"
      className={`grid grid-cols-4 gap-2 ${className ?? ""}`}
    >
      {PLACEMENT_DEFS.map((def) => (
        <PlacementButton
          key={def.id}
          def={def}
          selected={selected.includes(def.id)}
          onSelect={() => onToggle(def.id)}
        />
      ))}
    </div>
  );
}

// ─── Identical-logo-setup toggle ──────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  activeColorCount: number;
  feeEstimate: number;
}

export function IdenticalLogoSetupToggle({
  checked,
  onChange,
  activeColorCount,
  feeEstimate,
}: ToggleProps) {
  return (
    <div
      className={[
        "mt-2 rounded-xl border px-3 py-2.5 transition-colors",
        checked
          ? "border-ink-100 bg-ink-25"
          : "border-warning-500 bg-warning-100/60",
      ].join(" ")}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none cursor-pointer rounded border-ink-300 text-accent-500 focus:ring-2 focus:ring-accent-500 focus:ring-offset-1"
          aria-describedby="identical-logo-setup-help"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-[12.5px] font-semibold text-ink-800">
              Configuration de logo identique pour toutes les couleurs d'articles
            </span>
            {!checked && feeEstimate > 0 && (
              <span className="rounded-md bg-warning-500/20 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-warning-500">
                +{feeEstimate.toFixed(2).replace(".", ",")}€ calage
              </span>
            )}
          </div>
          <p
            id="identical-logo-setup-help"
            className="mt-0.5 text-[11.5px] leading-snug text-ink-500"
          >
            {checked ? (
              <>
                Le même calage couvre les <strong>{activeColorCount}</strong>{" "}
                couleurs d'articles → prix dégressif sur la quantité totale.
                Décocher pour adapter la couleur du logo à chaque vêtement
                (frais de calage supplémentaires par couleur).
              </>
            ) : (
              <>
                Couleur du logo adaptée à chaque vêtement → arrêt machine,
                nettoyage des cadres et nouveau calage par couleur additionnelle.
                Cocher pour conserver le même marquage partout.
              </>
            )}
          </p>
        </div>
      </label>
    </div>
  );
}

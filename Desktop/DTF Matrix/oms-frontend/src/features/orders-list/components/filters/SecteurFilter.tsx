import { useRef, useState } from "react";
import { SECTEUR_LABELS, type Secteur } from "@/lib/types";
import { SECTEUR_LIST } from "../../constants";
import { PillButton } from "../PillButton";
import { Popover } from "../Popover";

interface Props {
  value: Secteur[];
  onChange: (updater: (prev: Secteur[]) => Secteur[]) => void;
}

export function SecteurFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const count = value.length;

  function toggle(s: Secteur) {
    onChange((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div style={{ position: "relative" }}>
      <PillButton
        ref={anchorRef}
        active={count > 0}
        onClick={() => setOpen((o) => !o)}
      >
        {count > 0 ? `Secteur : ${count} sélectionné${count > 1 ? "s" : ""}` : "Secteur"}
      </PillButton>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} minWidth={220}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: 4,
            maxWidth: 260,
          }}
        >
          {SECTEUR_LIST.map((s) => {
            const checked = value.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={checked}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 5,
                  background: checked ? "var(--brand-duck-500)" : "var(--brand-linen)",
                  color: checked ? "var(--fg-on-primary)" : "var(--fg-2)",
                  border: "1px solid",
                  borderColor: checked ? "var(--brand-duck-500)" : "rgba(74,98,116,0.10)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {SECTEUR_LABELS[s]}
              </button>
            );
          })}
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange(() => [])}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              borderRadius: 6,
              background: "transparent",
              border: "none",
              color: "var(--brand-duck-500)",
              fontSize: 11.5,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            Tout effacer
          </button>
        )}
      </Popover>
    </div>
  );
}

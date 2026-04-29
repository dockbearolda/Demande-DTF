import { useRef, useState } from "react";
import { PillButton } from "../PillButton";
import { Popover } from "../Popover";
import type { DatePresetId, DateRange } from "../../types";

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
}

const PRESETS: Array<{ id: DatePresetId; label: string }> = [
  { id: "this_week", label: "Cette semaine" },
  { id: "this_month", label: "Ce mois" },
  { id: "overdue", label: "Échus" },
  { id: "due_7d", label: "À livrer < 7j" },
  { id: "custom", label: "Personnalisé" },
];

const PRESET_LABELS: Record<DatePresetId, string> = {
  this_week: "Cette semaine",
  this_month: "Ce mois",
  overdue: "Échus",
  due_7d: "À livrer < 7j",
  custom: "Personnalisé",
};

function formatRangeLabel(r: DateRange): string {
  if (!r.preset && !r.from && !r.to) return "Date";
  if (r.preset && r.preset !== "custom") return PRESET_LABELS[r.preset];
  if (r.preset === "custom") {
    if (r.from && r.to) return `Du ${r.from} au ${r.to}`;
    if (r.from) return `Depuis ${r.from}`;
    if (r.to) return `Jusqu'au ${r.to}`;
  }
  return "Date";
}

export function DateRangeFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const active = !!value.preset || !!value.from || !!value.to;
  const label = formatRangeLabel(value);

  function pickPreset(id: DatePresetId) {
    if (id === "custom") {
      onChange({ preset: "custom", from: value.from, to: value.to });
      return;
    }
    if (value.preset === id) {
      onChange({ preset: null, from: null, to: null });
      return;
    }
    onChange({ preset: id, from: null, to: null });
  }

  return (
    <div style={{ position: "relative" }}>
      <PillButton
        ref={anchorRef}
        active={active}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </PillButton>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} minWidth={260}>
        <div style={{ padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          {PRESETS.map((p) => {
            const sel = value.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p.id)}
                aria-pressed={sel}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: sel ? "rgba(107,129,145,0.10)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: 12.5,
                  fontWeight: sel ? 600 : 500,
                  color: "var(--fg-1)",
                }}
                onMouseEnter={(e) => {
                  if (!sel) e.currentTarget.style.background = "rgba(107,129,145,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!sel) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "1.5px solid",
                    borderColor: sel ? "var(--brand-duck-500)" : "var(--brand-sage-100)",
                    background: sel ? "var(--brand-duck-500)" : "transparent",
                  }}
                />
                {p.label}
              </button>
            );
          })}

          {value.preset === "custom" && (
            <div
              style={{
                marginTop: 6,
                padding: "8px 8px 4px",
                borderTop: "1px solid var(--brand-sage-50)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fg-3)" }}>
                Du
                <input
                  type="date"
                  value={value.from ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, preset: "custom", from: e.target.value || null })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    height: 30,
                    marginTop: 2,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: "1px solid var(--brand-sage-100)",
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--fg-1)",
                    background: "white",
                  }}
                />
              </label>
              <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--fg-3)" }}>
                Au
                <input
                  type="date"
                  value={value.to ?? ""}
                  onChange={(e) =>
                    onChange({ ...value, preset: "custom", to: e.target.value || null })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    height: 30,
                    marginTop: 2,
                    padding: "0 8px",
                    borderRadius: 6,
                    border: "1px solid var(--brand-sage-100)",
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--fg-1)",
                    background: "white",
                  }}
                />
              </label>
            </div>
          )}

          {active && (
            <button
              type="button"
              onClick={() => onChange({ preset: null, from: null, to: null })}
              style={{
                marginTop: 6,
                padding: "6px 10px",
                borderRadius: 6,
                background: "transparent",
                border: "none",
                color: "var(--brand-duck-500)",
                fontSize: 11.5,
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              Effacer
            </button>
          )}
        </div>
      </Popover>
    </div>
  );
}

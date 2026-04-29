import { useRef, useState } from "react";
import { PillButton } from "../PillButton";
import { Popover } from "../Popover";
import { BAT_STATE_LABELS, type BatState, type ListFilters } from "../../types";

interface Props {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
}

const BAT_OPTIONS: BatState[] = ["todo", "wip", "validated"];

export function MoreFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const activeCount =
    (filters.q.trim() ? 1 : 0) +
    (filters.bat_state ? 1 : 0) +
    (filters.amount_min != null ? 1 : 0) +
    (filters.amount_max != null ? 1 : 0) +
    (filters.items_min != null ? 1 : 0) +
    (filters.items_max != null ? 1 : 0);

  function setNum(field: keyof ListFilters, raw: string) {
    const n = raw.trim() === "" ? null : Number(raw);
    if (n != null && !Number.isFinite(n)) return;
    onChange({ [field]: n } as Partial<ListFilters>);
  }

  return (
    <div style={{ position: "relative" }}>
      <PillButton
        ref={anchorRef}
        active={activeCount > 0}
        count={activeCount}
        onClick={() => setOpen((o) => !o)}
      >
        Plus de filtres
      </PillButton>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} minWidth={300} align="end">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 4 }}>
          <Field label="Recherche (réf., notes, contact)">
            <input
              type="text"
              value={filters.q}
              onChange={(e) => onChange({ q: e.target.value })}
              placeholder="ex. 2026-0042 ou Vito"
              style={inputStyle}
            />
          </Field>

          <Field label="État BAT">
            <div style={{ display: "flex", gap: 4 }}>
              {BAT_OPTIONS.map((s) => {
                const sel = filters.bat_state === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ bat_state: sel ? null : s })}
                    aria-pressed={sel}
                    style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 6,
                      border: "1px solid",
                      borderColor: sel ? "var(--brand-duck-500)" : "var(--brand-sage-100)",
                      background: sel ? "var(--brand-duck-500)" : "white",
                      color: sel ? "var(--fg-on-primary)" : "var(--fg-2)",
                      fontSize: 11.5,
                      fontWeight: sel ? 700 : 500,
                    }}
                  >
                    {BAT_STATE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Montant € (HT)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={filters.amount_min ?? ""}
                onChange={(e) => setNum("amount_min", e.target.value)}
                style={inputStyle}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={filters.amount_max ?? ""}
                onChange={(e) => setNum("amount_max", e.target.value)}
                style={inputStyle}
              />
            </div>
          </Field>

          <Field label="Articles (qté totale)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={filters.items_min ?? ""}
                onChange={(e) => setNum("items_min", e.target.value)}
                style={inputStyle}
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={filters.items_max ?? ""}
                onChange={(e) => setNum("items_max", e.target.value)}
                style={inputStyle}
              />
            </div>
          </Field>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  q: "",
                  bat_state: null,
                  amount_min: null,
                  amount_max: null,
                  items_min: null,
                  items_max: null,
                })
              }
              style={{
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
        </div>
      </Popover>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  borderRadius: 7,
  border: "1px solid var(--brand-sage-100)",
  background: "white",
  fontSize: 12.5,
  color: "var(--fg-1)",
  fontVariantNumeric: "tabular-nums",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

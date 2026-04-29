import { useRef, useState } from "react";
import {
  ORDER_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/types";
import { ARCHIVED_STATUSES, STATUS_BUSINESS_ORDER } from "../../constants";
import { PillButton } from "../PillButton";
import { Popover } from "../Popover";

interface Props {
  value: OrderStatus[];
  onChange: (updater: (prev: OrderStatus[]) => OrderStatus[]) => void;
}

const ORDERED: OrderStatus[] = STATUS_BUSINESS_ORDER.filter((s) => ORDER_STATUSES.includes(s));

export function StatusFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const count = value.length;

  function toggle(s: OrderStatus) {
    onChange((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div style={{ position: "relative" }}>
      <PillButton
        ref={anchorRef}
        active={count > 0}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {count > 0 ? `Statut : ${count} sélectionné${count > 1 ? "s" : ""}` : "Statut"}
      </PillButton>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} minWidth={260}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px 6px",
              borderBottom: "1px solid var(--brand-sage-50)",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
              }}
            >
              Statut
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(() => [])}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--brand-duck-500)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Tout effacer
              </button>
            )}
          </div>
          {ORDERED.map((s) => {
            const checked = value.includes(s);
            const c = STATUS_COLORS[s];
            const isArchived = ARCHIVED_STATUSES.includes(s);
            return (
              <button
                key={s}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={() => toggle(s)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: checked ? "rgba(107,129,145,0.08)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: 12.5,
                  color: "var(--fg-1)",
                }}
                onMouseEnter={(e) => {
                  if (!checked) e.currentTarget.style.background = "rgba(107,129,145,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!checked) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    flexShrink: 0,
                    border: "1.5px solid",
                    borderColor: checked ? "var(--brand-duck-500)" : "var(--brand-sage-100)",
                    borderRadius: 3,
                    background: checked ? "var(--brand-duck-500)" : "transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--fg-on-primary)",
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {checked ? "✓" : ""}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: c.bg,
                    color: c.fg,
                    padding: "2px 8px",
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: c.dot,
                    }}
                  />
                  {STATUS_LABELS[s]}
                </span>
                {isArchived && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color: "var(--fg-4)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Archivé
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}

import { useRef, useState } from "react";
import { COLUMN_DEFS, type ColumnId } from "../types";
import { Popover } from "./Popover";

interface Props {
  visible: ColumnId[];
  onChange: (next: ColumnId[]) => void;
}

function IconColumns() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export function ColumnsMenu({ visible, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  function toggle(id: ColumnId, optional: boolean) {
    if (!optional) return; // colonne obligatoire — non débrayable
    if (visible.includes(id)) onChange(visible.filter((x) => x !== id));
    else onChange([...visible, id]);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 12px",
          borderRadius: 8,
          background: "var(--brand-paper-hi)",
          border: "1px solid var(--brand-sage-100)",
          color: "var(--fg-2)",
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        <IconColumns />
        Colonnes
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        minWidth={240}
        align="end"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 4 }}>
          <span
            style={{
              padding: "0 8px 6px",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-3)",
            }}
          >
            Colonnes affichées
          </span>
          {COLUMN_DEFS.map((c) => {
            const checked = visible.includes(c.id);
            const required = !c.optional;
            return (
              <button
                key={c.id}
                type="button"
                disabled={required}
                onClick={() => toggle(c.id, !!c.optional)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: checked ? "rgba(107,129,145,0.06)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: 12.5,
                  color: required ? "var(--fg-3)" : "var(--fg-1)",
                  cursor: required ? "not-allowed" : "default",
                  opacity: required ? 0.7 : 1,
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
                <span style={{ flex: 1 }}>{c.label}</span>
                {required && (
                  <span
                    style={{
                      fontSize: 9.5,
                      color: "var(--fg-4)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Toujours
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

import { useRef, useState } from "react";
import type { ColumnId, ListFilters, SavedView, SortRule } from "../types";
import { Popover } from "./Popover";

interface Props {
  views: SavedView[];
  /** Snapshot courant pour pouvoir l'enregistrer en un clic. */
  snapshot: { filters: ListFilters; sort: SortRule[]; columns: ColumnId[] };
  onSave: (
    name: string,
    snapshot: { filters: ListFilters; sort: SortRule[]; columns: ColumnId[] },
  ) => SavedView;
  onApply: (view: SavedView) => void;
  onDelete: (id: string) => void;
}

function IconBookmark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5 3v18l7-5 7 5V3a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z" />
    </svg>
  );
}

export function SaveViewMenu({ views, snapshot, onSave, onApply, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    if (!name.trim()) {
      inputRef.current?.focus();
      return;
    }
    onSave(name, snapshot);
    setName("");
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Vues sauvegardées"
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
        <span style={{ color: "var(--brand-duck-500)" }}>
          <IconBookmark />
        </span>
        Vues
        {views.length > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              background: "var(--brand-sage-100)",
              color: "var(--fg-2)",
              fontSize: 10.5,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {views.length}
          </span>
        )}
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        minWidth={300}
        align="end"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 4 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-3)",
              padding: "0 4px",
            }}
          >
            Enregistrer la vue courante
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder="Mes urgents Trotec…"
              style={{
                flex: 1,
                height: 32,
                padding: "0 10px",
                borderRadius: 7,
                border: "1px solid var(--brand-sage-100)",
                background: "white",
                fontSize: 12.5,
                color: "var(--fg-1)",
              }}
            />
            <button
              type="button"
              onClick={commit}
              disabled={!name.trim()}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: 7,
                background: name.trim() ? "var(--brand-duck-500)" : "var(--brand-sage-100)",
                color: name.trim() ? "var(--fg-on-primary)" : "var(--fg-4)",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Enregistrer
            </button>
          </div>

          <div style={{ height: 1, background: "var(--brand-sage-50)", margin: "4px 0" }} />

          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-3)",
              padding: "0 4px",
            }}
          >
            Vues sauvegardées
          </span>

          {views.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "8px 4px",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              Aucune vue. Donne un nom à la combinaison filtres + tri + colonnes
              actuelle pour la rappeler en un clic.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 240, overflowY: "auto" }}>
              {views.map((v) => (
                <li
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(107,129,145,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onApply(v);
                      setOpen(false);
                    }}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      padding: "2px 4px",
                      background: "transparent",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--fg-1)",
                    }}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
                    aria-label={`Supprimer la vue ${v.name}`}
                    title="Supprimer la vue"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      background: "transparent",
                      border: "none",
                      color: "var(--fg-4)",
                      fontSize: 11,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(220,38,38,0.10)";
                      e.currentTarget.style.color = "var(--color-danger)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--fg-4)";
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Popover>
    </div>
  );
}

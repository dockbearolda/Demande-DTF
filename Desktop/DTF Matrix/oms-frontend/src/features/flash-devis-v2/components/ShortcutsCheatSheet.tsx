/**
 * Cheat sheet en overlay listant les raccourcis clavier de Devis Flash v2.
 *
 * Ouverte/fermée par la touche `?` (Shift+/). Esc ferme — géré par le
 * hook `useKeyboardShortcuts`, qui appelle `onClose` quand `open` vaut
 * `true`.
 */

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Row {
  keys: string[];
  label: string;
}

const ROWS: Array<{ section: string; rows: Row[] }> = [
  {
    section: "Recherche & navigation",
    rows: [
      { keys: ["/"], label: "Focus la recherche" },
      { keys: ["Ctrl", "K"], label: "Focus la recherche (depuis un champ)" },
      { keys: ["↑", "↓"], label: "Naviguer la liste de modèles" },
      { keys: ["Enter"], label: "Sélectionner le modèle surligné" },
      { keys: ["Esc"], label: "Vider la recherche" },
    ],
  },
  {
    section: "Quantité",
    rows: [
      { keys: ["+"], label: "Quantité +1" },
      { keys: ["-"], label: "Quantité −1" },
      { keys: ["Shift", "↑"], label: "Quantité +10" },
      { keys: ["Shift", "↓"], label: "Quantité −10" },
    ],
  },
  {
    section: "Emplacements logos",
    rows: [
      { keys: ["1"], label: "Cœur" },
      { keys: ["2"], label: "Poitrine" },
      { keys: ["3"], label: "Avant plein" },
      { keys: ["4"], label: "Arrière plein" },
      { keys: ["5"], label: "Manche G" },
      { keys: ["6"], label: "Manche D" },
    ],
  },
  {
    section: "Options",
    rows: [
      { keys: ["t"], label: "Transport on/off" },
      { keys: ["g"], label: "TGCA on/off" },
    ],
  },
  {
    section: "Aide",
    rows: [{ keys: ["?"], label: "Ouvrir/fermer cette aide" }],
  },
];

export function ShortcutsCheatSheet({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Raccourcis clavier"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(20,28,38,0.45)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 90vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 14,
          padding: "20px 24px 22px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--fg-1)",
            }}
          >
            Raccourcis clavier
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(74,98,116,0.18)",
              background: "#fff",
              fontSize: 12,
              color: "var(--fg-2)",
              cursor: "pointer",
            }}
          >
            Esc
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {ROWS.map((section) => (
            <section key={section.section}>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--fg-4)",
                }}
              >
                {section.section}
              </h3>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 4,
                }}
              >
                {section.rows.map((row) => (
                  <li
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "4px 0",
                      fontSize: 13,
                      color: "var(--fg-1)",
                    }}
                  >
                    <span>{row.label}</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      {row.keys.map((k, i) => (
                        <kbd
                          key={i}
                          style={{
                            display: "inline-block",
                            minWidth: 22,
                            padding: "2px 6px",
                            borderRadius: 6,
                            border: "1px solid rgba(74,98,116,0.22)",
                            background: "rgba(244,244,242,0.85)",
                            fontFamily:
                              "var(--font-mono, ui-monospace, monospace)",
                            fontSize: 11.5,
                            fontWeight: 600,
                            textAlign: "center",
                            color: "var(--fg-1)",
                            boxShadow:
                              "0 1px 0 rgba(74,98,116,0.18), inset 0 -1px 0 rgba(74,98,116,0.08)",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

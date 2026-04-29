import { useState } from "react";
import { createPortal } from "react-dom";
import {
  useActiveShortcuts,
  useKeyboardShortcuts,
  type Shortcut,
} from "@/hooks/useKeyboardShortcuts";
import { KbdBadge } from "./KbdBadge";

/**
 * Overlay listant les raccourcis clavier actuellement actifs.
 * S'ouvre via "?" ou F1, se ferme via Escape ou un clic sur le fond.
 */
export function ShortcutsHelpOverlay() {
  const [open, setOpen] = useState(false);
  const shortcuts = useActiveShortcuts();

  // Toujours actif : "?" et F1 ouvrent l'overlay (overlay fermé)
  useKeyboardShortcuts(
    [
      {
        key: "?",
        label: "Afficher les raccourcis",
        group: "Aide",
        handler: () => setOpen((v) => !v),
      },
      {
        key: "F1",
        label: "Afficher les raccourcis (F1)",
        group: "Aide",
        handler: () => setOpen((v) => !v),
      },
    ],
    { enabled: !open },
  );

  // Quand ouvert, Escape ferme
  useKeyboardShortcuts(
    [
      {
        key: "Escape",
        label: "Fermer l'aide",
        group: "Aide",
        handler: () => setOpen(false),
        guardInput: false,
      },
    ],
    { enabled: open },
  );

  if (!open) return null;

  // Grouper par `group`
  const groups = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const g = s.group ?? "Général";
    const list = groups.get(g) ?? [];
    list.push(s);
    groups.set(g, list);
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="shortcuts-help-title"
            className="text-base font-bold text-slate-900"
          >
            Raccourcis clavier actifs
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {shortcuts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun raccourci enregistré sur cet écran.
          </p>
        ) : (
          <div className="space-y-4">
            {[...groups.entries()].map(([group, items]) => (
              <section key={group}>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {group}
                </h3>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((s) => (
                    <li
                      key={`${group}:${s.key}`}
                      className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5"
                    >
                      <KbdBadge>{prettyKey(s.key)}</KbdBadge>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          <KbdBadge>Esc</KbdBadge> pour fermer · <KbdBadge>?</KbdBadge> pour
          ré-ouvrir
        </p>
      </div>
    </div>,
    document.body,
  );
}

function prettyKey(key: string): string {
  if (key === " " || key === "Space") return "Espace";
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  if (key === "Enter") return "↵";
  if (key === "Escape") return "Esc";
  return key.toUpperCase();
}

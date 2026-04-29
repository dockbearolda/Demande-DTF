import { useEffect, useReducer, useRef } from "react";

/**
 * Système global de raccourcis clavier.
 *
 * - Chaque hook `useKeyboardShortcuts` enregistre un *scope* de raccourcis.
 * - Les scopes sont empilés ; le scope le plus récemment monté gagne en cas de
 *   conflit (un seul listener actif par touche).
 * - Désactivation automatique quand un input/textarea/select/contentEditable
 *   a le focus (sauf si le raccourci passe `guardInput: false`).
 * - Un seul listener `keydown` global, installé à la première utilisation.
 */

export interface Shortcut {
  /**
   * Touche cible. Peut être :
   * - un caractère unique : "1", "h", "?"
   * - un nom de touche standard : "Escape", "F1", "ArrowDown", "Enter", " " (Space)
   *   La comparaison est insensible à la casse pour les caractères.
   */
  key: string;
  /** Handler appelé quand la touche est pressée. Reçoit l'event natif. */
  handler: (e: KeyboardEvent) => void;
  /** Libellé court pour l'overlay d'aide (ex. "Catégorie 1"). */
  label: string;
  /** Description plus longue, optionnelle. */
  description?: string;
  /** Si false, le raccourci se déclenche aussi quand un input a le focus. Défaut: true. */
  guardInput?: boolean;
  /** Groupe pour l'overlay d'aide (ex. "S1 — Catégories"). */
  group?: string;
}

interface ScopeEntry {
  id: number;
  ref: { current: Shortcut[] };
  enabled: { current: boolean };
}

const scopes: ScopeEntry[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
let installed = false;

function notify() {
  for (const l of listeners) l();
}

function isTypingInElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Combobox/listbox roles often type-ahead — treat as typing context
  const role = target.getAttribute("role");
  if (role === "combobox" || role === "searchbox") return true;
  return false;
}

function matches(e: KeyboardEvent, key: string): boolean {
  // Ignore pure modifier presses
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (key === "?") {
    // "?" demande Shift sur la plupart des claviers AZERTY/QWERTY
    return e.key === "?";
  }
  if (key === " " || key === "Space") {
    return e.key === " " || e.code === "Space";
  }
  if (key.length === 1) {
    return e.key.toLowerCase() === key.toLowerCase();
  }
  return e.key === key;
}

function onKey(e: KeyboardEvent) {
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (!scope.enabled.current) continue;
    for (const s of scope.ref.current) {
      const guard = s.guardInput !== false;
      if (guard && isTypingInElement(e.target)) continue;
      if (matches(e, s.key)) {
        e.preventDefault();
        e.stopPropagation();
        s.handler(e);
        return;
      }
    }
  }
}

function ensureInstalled() {
  if (installed || typeof window === "undefined") return;
  window.addEventListener("keydown", onKey);
  installed = true;
}

/**
 * Enregistre un scope de raccourcis. Les `shortcuts` sont lus à chaque keydown
 * via une ref interne, donc passer un nouveau tableau à chaque rendu est OK
 * (pas de re-register coûteux). Le scope est démonté automatiquement.
 */
export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  opts: { enabled?: boolean } = {},
): void {
  const enabled = opts.enabled !== false;
  const shortcutsRef = useRef<Shortcut[]>(shortcuts);
  shortcutsRef.current = shortcuts;
  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    ensureInstalled();
    const id = nextId++;
    const entry: ScopeEntry = { id, ref: shortcutsRef, enabled: enabledRef };
    scopes.push(entry);
    notify();
    return () => {
      const idx = scopes.findIndex((s) => s.id === id);
      if (idx !== -1) scopes.splice(idx, 1);
      notify();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Liste, à un instant t, des raccourcis actuellement actifs (le plus récent
 * scope gagne en cas de conflit). Utilisé par l'overlay d'aide.
 */
export function useActiveShortcuts(): Shortcut[] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  const seen = new Set<string>();
  const out: Shortcut[] = [];
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (!scope.enabled.current) continue;
    for (const s of scope.ref.current) {
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      out.push(s);
    }
  }
  return out;
}

// Utilitaires exportés pour les tests / l'introspection
export function _resetShortcutsForTest() {
  scopes.length = 0;
  listeners.clear();
}

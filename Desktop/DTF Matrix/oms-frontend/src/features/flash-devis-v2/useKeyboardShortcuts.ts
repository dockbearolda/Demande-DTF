/**
 * Raccourcis clavier globaux pour Devis Flash v2 (étape 4).
 *
 * Bindings :
 *   /              → focus champ recherche (col 1)
 *   Ctrl/Cmd+K     → idem (fonctionne même si un input est focus)
 *   Esc            → si cheat sheet ouvert : fermer ;
 *                    sinon si search a le focus : vider + blur ;
 *                    sinon : no-op
 *   ?              → ouvre/ferme la cheat sheet
 *   1..6           → toggle emplacement (Coeur, Poitrine, AvantPlein,
 *                    ArrierePlein, MancheG, MancheD — ordre canonique
 *                    de ALL_PLACEMENTS)
 *   + / =          → qty +1
 *   -              → qty -1 (borne basse 1, gérée par le store)
 *   Shift+↑        → qty +10
 *   Shift+↓        → qty -10
 *   t              → toggle Transport
 *   g              → toggle TGCA
 *
 * Garde-fous :
 *   - Si le focus est dans un <input>/<textarea>/[contenteditable], les
 *     raccourcis non navigationnels (1..6, +/-, t, g, Shift+↑↓, ?) sont
 *     ignorés afin de ne pas polluer la frappe. Ne restent actifs : Esc,
 *     Ctrl/Cmd+K.
 *   - Les raccourcis qui modifient le devis (qty, placements, toggles)
 *     ne déclenchent rien tant qu'aucun modèle n'est sélectionné.
 */

import { useEffect, type RefObject } from "react";
import { ALL_PLACEMENTS } from "@/features/pricing";
import { useFlashDevisV2Store } from "./store";

export interface UseKeyboardShortcutsOptions {
  searchInputRef: RefObject<HTMLInputElement | null>;
  cheatSheetOpen: boolean;
  onToggleCheatSheet: () => void;
  onCloseCheatSheet: () => void;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts({
  searchInputRef,
  cheatSheetOpen,
  onToggleCheatSheet,
  onCloseCheatSheet,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore les events synthétiques (IME composition).
      if (e.isComposing) return;

      const target = e.target;
      const inEditable = isEditableTarget(target);
      const isSearchInput =
        target instanceof HTMLElement &&
        searchInputRef.current !== null &&
        target === searchInputRef.current;

      // ── Esc — toujours actif ───────────────────────────────────────
      if (e.key === "Escape") {
        if (cheatSheetOpen) {
          onCloseCheatSheet();
          e.preventDefault();
          return;
        }
        if (isSearchInput) {
          useFlashDevisV2Store.getState().setSearch("");
          (target as HTMLInputElement).value = "";
          (target as HTMLInputElement).blur();
          e.preventDefault();
          return;
        }
        return;
      }

      // ── Ctrl/Cmd+K — focus search (perce le guard input) ───────────
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        e.preventDefault();
        return;
      }

      // ── À partir d'ici, on respecte le guard input pour les autres
      //    raccourcis qui pourraient être confondus avec une frappe.
      // ─────────────────────────────────────────────────────────────

      // / — focus search (uniquement hors input)
      if (e.key === "/" && !inEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        e.preventDefault();
        return;
      }

      // ? — toggle cheat sheet (hors input ; "?" = Shift+/ → e.key === "?")
      if (e.key === "?" && !inEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        onToggleCheatSheet();
        e.preventDefault();
        return;
      }

      if (inEditable) return;

      const store = useFlashDevisV2Store.getState();
      const hasModel = store.selectedModelRef !== null;

      // ── Quantité ──────────────────────────────────────────────────
      if (e.shiftKey && e.key === "ArrowUp") {
        if (!hasModel) return;
        store.setQuantity(store.quantity + 10);
        e.preventDefault();
        return;
      }
      if (e.shiftKey && e.key === "ArrowDown") {
        if (!hasModel) return;
        store.setQuantity(store.quantity - 10);
        e.preventDefault();
        return;
      }
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "+" || e.key === "=") {
          if (!hasModel) return;
          store.setQuantity(store.quantity + 1);
          e.preventDefault();
          return;
        }
        if (e.key === "-") {
          if (!hasModel) return;
          store.setQuantity(store.quantity - 1);
          e.preventDefault();
          return;
        }
      }

      // ── Emplacements 1..6 ─────────────────────────────────────────
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const idx = ["1", "2", "3", "4", "5", "6"].indexOf(e.key);
        if (idx >= 0) {
          if (!hasModel) return;
          const placement = ALL_PLACEMENTS[idx];
          if (placement) {
            store.togglePlacement(placement);
            e.preventDefault();
          }
          return;
        }
      }

      // ── Toggles t / g ─────────────────────────────────────────────
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "t") {
          if (!hasModel) return;
          store.setTransportActive(!store.transportActive);
          e.preventDefault();
          return;
        }
        if (e.key === "g") {
          if (!hasModel) return;
          store.setTgcaActive(!store.tgcaActive);
          e.preventDefault();
          return;
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cheatSheetOpen, onCloseCheatSheet, onToggleCheatSheet, searchInputRef]);
}

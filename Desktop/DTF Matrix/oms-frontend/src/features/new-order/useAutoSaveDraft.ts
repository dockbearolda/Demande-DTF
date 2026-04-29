import { useEffect, useRef } from "react";
import { create } from "zustand";
import { api } from "@/lib/api";
import type { DraftUpsertBody } from "@/hooks/useDrafts";
import { isClassicLine, isTextileLine } from "./types";
import {
  selectDraftId,
  useNewOrderStore,
  type WizardStep,
} from "./store";
import { getQuoteId } from "./quoteId";
import type { OrderDraft, OrderLine } from "./types";

/** Debounce window for « modification → save ». 5 s per spec — short enough
 *  that the user feels the indicator settle quickly, long enough to coalesce
 *  bursts of typing into a single request. */
const DEBOUNCE_MS = 5_000;

export type AutoSaveState = "idle" | "saving" | "saved" | "error" | "offline";

interface AutoSaveStore {
  state: AutoSaveState;
  lastSavedAt: number | null;
  errorMessage: string | null;
  set: (patch: Partial<Omit<AutoSaveStore, "set">>) => void;
}

export const useAutoSaveStatus = create<AutoSaveStore>((set) => ({
  state: "idle",
  lastSavedAt: null,
  errorMessage: null,
  set: (patch) => set(patch),
}));

/** True when the draft holds anything worth persisting — empty headers + zero
 *  lines = no save (avoid creating noise files for users who just opened
 *  /orders/new without typing anything). */
function isDraftMeaningful(draft: OrderDraft): boolean {
  const { header, lines } = draft;
  if (header.clientNom.trim()) return true;
  if (header.notes.trim()) return true;
  if (header.dateLivraison) return true;
  if (header.personneContact.trim()) return true;
  if (header.telephone.trim()) return true;
  if (lines.length > 0) return true;
  return false;
}

/** Total quantity across every line — surfaced in the Brouillons listing
 *  ("12 articles") and shapes the auto-save summary fields. */
function computeItemCount(lines: OrderLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (isClassicLine(line)) {
      total += line.quantity || 0;
    } else if (isTextileLine(line)) {
      for (const item of Object.values(line.items)) {
        total += item.qty || 0;
      }
    }
  }
  return total;
}

function genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Sub-optimal fallback for very old browsers — uuid-shape, lower entropy.
  // Acceptable since Dropbox + filename collisions are practically nil.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildPayload(
  state: { draft: OrderDraft; currentStep: WizardStep },
): DraftUpsertBody {
  const { draft, currentStep } = state;
  return {
    payload: {
      draft,
      currentStep,
    } as Record<string, unknown>,
    client_name: draft.header.clientNom.trim() || null,
    item_count: computeItemCount(draft.lines.map((r) => r.line)),
    reference_count: draft.lines.length,
    last_step: currentStep,
    quote_id: getQuoteId(),
  };
}

/**
 * Mount once at the root of `OrderForm`. Subscribes to the wizard store,
 * debounces 5 s after every meaningful change, then PUT /drafts/{id}. Status
 * is mirrored to `useAutoSaveStatus` so the indicator next to the title can
 * render it live.
 */
export function useAutoSaveDraft(): void {
  const setStatus = useAutoSaveStatus((s) => s.set);
  const draftId = useNewOrderStore(selectDraftId);
  const setDraftId = useNewOrderStore((s) => s.setDraftId);

  // Refs so the subscription handler stays stable across renders.
  const draftIdRef = useRef<string | null>(draftId);
  draftIdRef.current = draftId;
  const setDraftIdRef = useRef(setDraftId);
  setDraftIdRef.current = setDraftId;

  useEffect(() => {
    let timer: number | null = null;
    let inFlight: AbortController | null = null;
    let lastSerialized: string | null = null;

    const flush = async () => {
      const state = useNewOrderStore.getState();
      if (!isDraftMeaningful(state.draft)) {
        return;
      }
      const body = buildPayload(state);
      const serialized = JSON.stringify(body.payload);
      if (serialized === lastSerialized) return; // nothing actually changed
      lastSerialized = serialized;

      // Lazily mint a draft id on first meaningful change. Stored back into
      // the store so it persists in localStorage for next reload.
      let id = draftIdRef.current;
      if (!id) {
        id = genUuid();
        setDraftIdRef.current(id);
        draftIdRef.current = id;
      }

      // Garde-course : si entre la planification et l'exécution du flush
      // l'utilisateur a réinitialisé le store (reset() vide draftId), on
      // abandonne — sinon on recréerait le brouillon serveur juste après
      // que le caller (e.g. doCreate après création réussie) l'ait supprimé.
      if (useNewOrderStore.getState().draftId !== id) {
        return;
      }

      if (inFlight) inFlight.abort();
      inFlight = new AbortController();
      setStatus({ state: "saving", errorMessage: null });
      try {
        await api.put(`/drafts/${id}`, body, { signal: inFlight.signal });
        setStatus({ state: "saved", lastSavedAt: Date.now(), errorMessage: null });
      } catch (err) {
        if (
          (err as { name?: string })?.name === "CanceledError" ||
          (err as { name?: string })?.name === "AbortError"
        ) {
          return;
        }
        // Network down → keep the localStorage copy and surface "Hors ligne".
        // The next successful flush will reconcile.
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        setStatus({
          state: offline ? "offline" : "error",
          errorMessage:
            (err as { message?: string })?.message ?? "Échec de la sauvegarde",
        });
      } finally {
        inFlight = null;
      }
    };

    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void flush();
      }, DEBOUNCE_MS);
    };

    const unsub = useNewOrderStore.subscribe((state, prev) => {
      // Only meaningful state changes matter — e.g. expanding/collapsing a
      // row mutates expandedLineId without changing data the server cares
      // about, but it's cheap enough to debounce-and-skip via lastSerialized.
      if (
        state.draft === prev.draft &&
        state.currentStep === prev.currentStep
      ) {
        return;
      }
      schedule();
    });

    return () => {
      unsub();
      if (timer !== null) window.clearTimeout(timer);
      if (inFlight) inFlight.abort();
    };
  }, [setStatus]);
}

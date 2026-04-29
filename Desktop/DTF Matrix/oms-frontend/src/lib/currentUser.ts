import type { OperatorValue } from "@/features/new-order/types";

const KEY = "dtf:current-user";
const EVENT = "dtf:current-user-change";
const VALID = new Set<OperatorValue>(["L", "C", "M", "A"]);

function emitChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // ignore
  }
}

export function clearCurrentUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  emitChange();
}

export function getCurrentUser(): OperatorValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw && VALID.has(raw as OperatorValue)) return raw as OperatorValue;
  } catch {
    // ignore
  }
  return null;
}

export function setCurrentUser(v: OperatorValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    // ignore quota errors
  }
  emitChange();
}

/** Subscribe to current-user changes (same-tab via custom event,
 *  cross-tab via the native `storage` event). Returns an unsubscribe. */
export function subscribeCurrentUser(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

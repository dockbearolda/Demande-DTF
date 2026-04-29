import { useEffect, useState } from "react";
import type { AssignedTo } from "@/lib/types";

/**
 * Mini-store en mémoire pour signaler qu'une commande est "verrouillée"
 * (en cours d'édition) par un opérateur. Sert l'indicateur cadenas dans la
 * liste — quand un autre opérateur ouvrira la même commande il verra
 * "Charlie modifie cette commande depuis 4 min".
 *
 * On garde volontairement ça côté client : pas de WebSocket pour l'instant.
 * Quand le pattern remote temps-réel arrivera, on remplacera l'implémentation
 * sans toucher l'API du hook.
 */

export interface OrderLock {
  /** Identifiant opérateur — utilisé pour résoudre le nom affiché. */
  operator: AssignedTo;
  /** Timestamp d'ouverture (ms). */
  startedAt: number;
}

type LockMap = Record<string, OrderLock>;

const NAMES: Record<AssignedTo, string> = {
  L: "Loïc",
  C: "Charlie",
  M: "Mélina",
};

const STORAGE_KEY = "orders-list:locks";
const TICK_MS = 30_000;

let state: LockMap = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): LockMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LockMap;
    // Purge les locks > 30 min (probablement abandonnés).
    const now = Date.now();
    const out: LockMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (now - v.startedAt < 30 * 60_000) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota exceeded — silent */
  }
}

function notify() {
  for (const l of listeners) l();
}

export function acquireLock(orderId: string, operator: AssignedTo): void {
  state = { ...state, [orderId]: { operator, startedAt: Date.now() } };
  persist();
  notify();
}

export function releaseLock(orderId: string): void {
  if (!state[orderId]) return;
  const { [orderId]: _gone, ...rest } = state;
  void _gone;
  state = rest;
  persist();
  notify();
}

export function getLock(orderId: string): OrderLock | null {
  return state[orderId] ?? null;
}

/**
 * S'abonne au store. Re-render quand l'état change ou toutes les 30s pour
 * rafraîchir les libellés relatifs ("il y a 4 min").
 */
export function useOrderLocks(): LockMap {
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((x) => x + 1);
    listeners.add(handler);
    const interval = setInterval(handler, TICK_MS);
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        state = loadFromStorage();
        handler();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(handler);
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return state;
}

export function useOrderLock(orderId: string | null): OrderLock | null {
  const all = useOrderLocks();
  if (!orderId) return null;
  return all[orderId] ?? null;
}

export function lockOperatorName(op: AssignedTo): string {
  return NAMES[op] ?? op;
}

export function lockRelativeMinutes(lock: OrderLock, now: number = Date.now()): number {
  return Math.max(0, Math.round((now - lock.startedAt) / 60_000));
}

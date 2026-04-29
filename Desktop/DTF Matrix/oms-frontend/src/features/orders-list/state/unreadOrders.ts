import { useEffect, useState } from "react";

/**
 * Set des commandes "modifiées par un autre opérateur depuis la dernière vue".
 * Affiche un dot bleu Duck Blue 6px à gauche de la checkbox de ligne.
 *
 * Implémentation purement locale pour l'instant — quand le canal temps-réel
 * sera branché, on remplacera l'init en chargeant depuis le serveur.
 */

let state: Set<string> = new Set();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function markUnread(orderId: string): void {
  if (state.has(orderId)) return;
  state = new Set(state);
  state.add(orderId);
  notify();
}

export function markRead(orderId: string): void {
  if (!state.has(orderId)) return;
  state = new Set(state);
  state.delete(orderId);
  notify();
}

export function clearAllUnread(): void {
  if (state.size === 0) return;
  state = new Set();
  notify();
}

export function useUnreadOrders(): Set<string> {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const handler = () => setSnapshot(state);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return snapshot;
}

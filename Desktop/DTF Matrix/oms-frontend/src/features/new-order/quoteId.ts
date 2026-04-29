/**
 * Identifiant de devis partagé entre `QuoteHeader` (en-tête principal) et
 * `OrderSidebar` (mini-aperçu PDF). Persisté en localStorage pour que la
 * valeur survive aux reloads et au flux brouillon → reprise — l'utilisateur
 * ne doit jamais voir deux numéros différents pour le même devis.
 */

const STORAGE_KEY = "dtf:new-order:quote-id";

let cached: string | null = null;

function generate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const n = String(Math.floor(Math.random() * 900) + 100);
  return `Devis #${y}-${m}${d}-${n}`;
}

function readPersisted(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writePersisted(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore — quoteId remains in-memory only
  }
}

export function getQuoteId(): string {
  if (cached === null) {
    cached = readPersisted() ?? generate();
    writePersisted(cached);
  }
  return cached;
}

/** Hydrate the singleton from an external source (e.g. resuming a stored
 *  draft). No-op when called with the same id we already cache. */
export function setQuoteId(value: string): void {
  if (cached === value) return;
  cached = value;
  writePersisted(value);
}

export function resetQuoteId(): void {
  cached = null;
  writePersisted(null);
}

const KEY = "dtf:recent-clients";
const MAX = 5;

export function getRecentClientIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

/** Push id to the front of the recents list, dedupe, cap at MAX. */
export function pushRecentClientId(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const current = getRecentClientIds().filter((x) => x !== id);
    const next = [id, ...current].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

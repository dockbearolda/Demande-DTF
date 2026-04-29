import type { Order, OrderLine } from "@/lib/types";

export interface ChildRow {
  /** Stable id : `${order.id}:${line.id}`. */
  id: string;
  orderId: string;
  line: OrderLine;
  /**
   * Tentative d'extraction couleur/taille depuis `line.notes` quand l'opérateur
   * a inscrit du structuré genre "Noir L:5 / M:3, Blanc M:2".
   *
   * Format reconnu : `<couleur> <taille>:<qté>`, séparés par `,` ou `/`.
   * Si rien ne matche on retourne `null` et la sous-ligne se contente d'un
   * affichage condensé `secteur · produit · ×qté`.
   */
  breakdown: BreakdownEntry[] | null;
}

export interface BreakdownEntry {
  color: string | null;
  size: string | null;
  qty: number;
}

const ENTRY_RE = /([A-Za-zÀ-ÿ]+)\s*([A-Za-z0-9]+)\s*[:×x]\s*(\d+)/g;

function parseBreakdown(notes: string | null): BreakdownEntry[] | null {
  if (!notes) return null;
  const entries: BreakdownEntry[] = [];
  for (const m of notes.matchAll(ENTRY_RE)) {
    const qty = Number(m[3]);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    entries.push({ color: m[1], size: m[2], qty });
  }
  return entries.length > 0 ? entries : null;
}

export function buildChildRows(order: Order): ChildRow[] {
  return (order.lines ?? []).map((line) => ({
    id: `${order.id}:${line.id}`,
    orderId: order.id,
    line,
    breakdown: parseBreakdown(line.notes),
  }));
}

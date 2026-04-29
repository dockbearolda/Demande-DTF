import type { Order, OrderStatus, Secteur } from "@/lib/types";
import { ARCHIVED_STATUSES, STATUS_RANK } from "../constants";
import type {
  BatState,
  DateRange,
  ListFilters,
  SortKey,
  SortRule,
} from "../types";

// ───────── Helpers ─────────

const DIACRITICS = /[̀-ͯ]/g;

function norm(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateOnly(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

/**
 * Résout un preset en bornes [from, to] (inclusives).
 * `null` signifie "pas de borne de ce côté".
 */
export function resolveDateRange(
  range: DateRange,
  now: Date = new Date(),
): { from: Date | null; to: Date | null } {
  if (range.preset === "custom" || !range.preset) {
    return {
      from: range.from ? startOfDay(new Date(range.from)) : null,
      to: range.to ? startOfDay(new Date(range.to)) : null,
    };
  }
  const today = startOfDay(now);
  switch (range.preset) {
    case "this_week": {
      // Lundi → dimanche.
      const dow = (today.getDay() + 6) % 7; // 0 = lundi
      const from = addDays(today, -dow);
      const to = addDays(from, 6);
      return { from, to };
    }
    case "this_month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: startOfDay(from), to: startOfDay(to) };
    }
    case "overdue":
      return { from: null, to: addDays(today, -1) };
    case "due_7d":
      return { from: today, to: addDays(today, 6) };
  }
}

// ───────── Dérivations Order → indicateurs ─────────

export function orderSecteurs(order: Order): Secteur[] {
  const set = new Set<Secteur>();
  for (const l of order.lines ?? []) set.add(l.secteur);
  return Array.from(set);
}

export function orderArticleCount(order: Order): number {
  let n = 0;
  for (const l of order.lines ?? []) n += Number(l.quantite) || 0;
  return n;
}

export function orderRefCount(order: Order): number {
  return (order.lines ?? []).length;
}

export function orderBatState(order: Order): BatState | null {
  switch (order.statut) {
    case "DRAFT":
    case "EN_ATTENTE_SOURCING":
    case "CONFIRMED":
      return "todo";
    case "EN_ATTENTE_BAT":
    case "BAT_SENT":
      return "wip";
    case "BAT_APPROVED":
    case "IN_PRODUCTION":
    case "SHIPPED":
    case "DELIVERED":
      return "validated";
    case "CANCELLED":
      return null;
  }
}

/** Nombre de jours depuis aujourd'hui jusqu'à la livraison (négatif = en retard). */
export function daysUntilDelivery(order: Order, now: Date = new Date()): number | null {
  const due = dateOnly(order.date_livraison_prevue);
  if (!due) return null;
  const today = startOfDay(now);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

// ───────── Filtres ─────────

export function applyFilters(orders: Order[], f: ListFilters): Order[] {
  const range = resolveDateRange(f.date);
  const q = f.q.trim() ? norm(f.q) : "";
  const statutSet = new Set<OrderStatus>(f.statuts);
  const secteurSet = new Set<Secteur>(f.secteurs);
  const assigneSet = new Set<string>(f.assignes);

  const out: Order[] = [];
  for (const o of orders) {
    // Statut
    if (statutSet.size > 0) {
      if (!statutSet.has(o.statut)) continue;
    } else if (ARCHIVED_STATUSES.includes(o.statut)) {
      continue;
    }
    // Secteur (multi)
    if (secteurSet.size > 0) {
      const secs = orderSecteurs(o);
      if (!secs.some((s) => secteurSet.has(s))) continue;
    }
    // Assigné
    if (assigneSet.size > 0) {
      const tag = o.assigned_to ?? "unassigned";
      if (!assigneSet.has(tag)) continue;
    }
    // Client
    if (f.client_id && o.client_id !== f.client_id) continue;
    // Date livraison (si bornes)
    if (range.from || range.to) {
      const due = dateOnly(o.date_livraison_prevue);
      if (!due) continue;
      if (range.from && due < range.from) continue;
      if (range.to && due > range.to) continue;
    }
    // Urgent
    if (f.urgent && !o.is_urgent) continue;
    // BAT state
    if (f.bat_state && orderBatState(o) !== f.bat_state) continue;
    // Montant
    const amt = Number(o.montant_total) || 0;
    if (f.amount_min != null && amt < f.amount_min) continue;
    if (f.amount_max != null && amt > f.amount_max) continue;
    // Articles
    const items = orderArticleCount(o);
    if (f.items_min != null && items < f.items_min) continue;
    if (f.items_max != null && items > f.items_max) continue;
    // Free text
    if (q) {
      const haystack = [
        o.reference,
        o.client?.nom ?? "",
        o.notes_globales ?? "",
        o.notes ?? "",
        o.personne_contact ?? "",
      ]
        .map(norm)
        .join(" ");
      if (!haystack.includes(q)) continue;
    }
    out.push(o);
  }
  return out;
}

// ───────── Tri multi-colonne ─────────

function compareKey(a: Order, b: Order, key: SortKey): number {
  switch (key) {
    case "statut":
      return STATUS_RANK[a.statut] - STATUS_RANK[b.statut];
    case "reference":
      return a.reference.localeCompare(b.reference);
    case "client":
      return (a.client?.nom ?? "").localeCompare(b.client?.nom ?? "");
    case "livraison": {
      const va = a.date_livraison_prevue ? new Date(a.date_livraison_prevue).getTime() : Infinity;
      const vb = b.date_livraison_prevue ? new Date(b.date_livraison_prevue).getTime() : Infinity;
      return va - vb;
    }
    case "date_creation":
      return new Date(a.date_commande).getTime() - new Date(b.date_commande).getTime();
    case "montant":
      return (Number(a.montant_total) || 0) - (Number(b.montant_total) || 0);
    case "secteur": {
      const sa = orderSecteurs(a).sort().join(",");
      const sb = orderSecteurs(b).sort().join(",");
      return sa.localeCompare(sb);
    }
  }
}

export function applyMultiSort(orders: Order[], rules: SortRule[]): Order[] {
  if (rules.length === 0) return orders;
  const arr = orders.slice();
  arr.sort((a, b) => {
    for (const r of rules) {
      const c = compareKey(a, b, r.key);
      if (c !== 0) return r.dir === "asc" ? c : -c;
    }
    return 0;
  });
  return arr;
}

// ───────── Résumé live (header + footer) ─────────

export interface ListSummary {
  count: number;
  urgent: number;
  totalAmount: number;
  totalItems: number;
}

export function summarize(orders: Order[]): ListSummary {
  let urgent = 0;
  let totalAmount = 0;
  let totalItems = 0;
  for (const o of orders) {
    if (o.is_urgent) urgent++;
    totalAmount += Number(o.montant_total) || 0;
    totalItems += orderArticleCount(o);
  }
  return { count: orders.length, urgent, totalAmount, totalItems };
}

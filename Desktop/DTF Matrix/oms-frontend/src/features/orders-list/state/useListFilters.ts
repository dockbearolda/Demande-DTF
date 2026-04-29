import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ORDER_STATUSES, type AssignedTo, type OrderStatus, type Secteur } from "@/lib/types";
import { SECTEUR_LIST, STORAGE_KEYS } from "../constants";
import {
  EMPTY_FILTERS,
  type BatState,
  type DatePresetId,
  type ListFilters,
} from "../types";

const DATE_PRESETS: DatePresetId[] = [
  "this_week",
  "this_month",
  "overdue",
  "due_7d",
  "custom",
];

const BAT_STATES: BatState[] = ["todo", "wip", "validated"];

// ───────── Sérialisation URL ─────────

function csv(values: string[]): string | null {
  return values.length === 0 ? null : values.join(",");
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseEnum<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  const set = new Set<T>(allowed);
  return parseCsv(raw).filter((v): v is T => set.has(v as T));
}

function parseInt0(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function serializeFilters(f: ListFilters): URLSearchParams {
  const sp = new URLSearchParams();
  const statuts = csv(f.statuts);
  if (statuts) sp.set("statut", statuts);
  const secteurs = csv(f.secteurs);
  if (secteurs) sp.set("secteur", secteurs);
  const assignes = csv(f.assignes);
  if (assignes) sp.set("assigne", assignes);
  if (f.client_id) sp.set("client", f.client_id);
  if (f.date.preset) sp.set("date", f.date.preset);
  if (f.date.from) sp.set("from", f.date.from);
  if (f.date.to) sp.set("to", f.date.to);
  if (f.urgent) sp.set("urgent", "1");
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.bat_state) sp.set("bat", f.bat_state);
  if (f.amount_min != null) sp.set("amin", String(f.amount_min));
  if (f.amount_max != null) sp.set("amax", String(f.amount_max));
  if (f.items_min != null) sp.set("imin", String(f.items_min));
  if (f.items_max != null) sp.set("imax", String(f.items_max));
  return sp;
}

export function parseFilters(sp: URLSearchParams): ListFilters {
  const preset = sp.get("date");
  const validPreset =
    preset && DATE_PRESETS.includes(preset as DatePresetId)
      ? (preset as DatePresetId)
      : null;
  const bat = sp.get("bat");
  return {
    statuts: parseEnum<OrderStatus>(sp.get("statut"), ORDER_STATUSES),
    secteurs: parseEnum<Secteur>(sp.get("secteur"), SECTEUR_LIST),
    assignes: parseEnum<AssignedTo | "unassigned">(sp.get("assigne"), [
      "L",
      "C",
      "M",
      "unassigned",
    ]),
    client_id: sp.get("client"),
    date: {
      preset: validPreset,
      from: sp.get("from"),
      to: sp.get("to"),
    },
    urgent: sp.get("urgent") === "1",
    q: sp.get("q") ?? "",
    bat_state: bat && BAT_STATES.includes(bat as BatState) ? (bat as BatState) : null,
    amount_min: parseInt0(sp.get("amin")),
    amount_max: parseInt0(sp.get("amax")),
    items_min: parseInt0(sp.get("imin")),
    items_max: parseInt0(sp.get("imax")),
  };
}

/**
 * Indique si au moins un filtre est actif (différent de l'état vide).
 * Sert à n'afficher "Réinitialiser" que quand c'est utile.
 */
export function hasActiveFilters(f: ListFilters): boolean {
  return (
    f.statuts.length > 0 ||
    f.secteurs.length > 0 ||
    f.assignes.length > 0 ||
    !!f.client_id ||
    !!f.date.preset ||
    !!f.date.from ||
    !!f.date.to ||
    f.urgent ||
    f.q.trim().length > 0 ||
    !!f.bat_state ||
    f.amount_min != null ||
    f.amount_max != null ||
    f.items_min != null ||
    f.items_max != null
  );
}

// ───────── Hook ─────────

/**
 * Synchronise les filtres avec l'URL en priorité ; au premier chargement,
 * retombe sur localStorage si l'URL est vide. Les modifications écrivent
 * en URL (replace) et en localStorage en miroir.
 */
/**
 * Clés des filtres dans l'URL — utilisées pour préserver les autres params
 * (notamment `?edit=…`) lors d'une mise à jour.
 */
const FILTER_KEYS = [
  "statut",
  "secteur",
  "assigne",
  "client",
  "date",
  "from",
  "to",
  "urgent",
  "q",
  "bat",
  "amin",
  "amax",
  "imin",
  "imax",
];

type Updater = ListFilters | ((prev: ListFilters) => ListFilters);
type PatchUpdater =
  | Partial<ListFilters>
  | ((prev: ListFilters) => Partial<ListFilters>);

export function useListFilters(): {
  filters: ListFilters;
  setFilters: (next: Updater) => void;
  patchFilters: (patch: PatchUpdater) => void;
  reset: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);

  // Hydratation initiale : si URL vide et localStorage rempli, pousse depuis LS.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const hasUrlFilter = Array.from(searchParams.keys()).some((k) =>
      [
        "statut",
        "secteur",
        "assigne",
        "client",
        "date",
        "from",
        "to",
        "urgent",
        "q",
        "bat",
        "amin",
        "amax",
        "imin",
        "imax",
      ].includes(k),
    );
    if (hasUrlFilter) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.filters);
      if (!raw) return;
      const stored = JSON.parse(raw) as ListFilters;
      const sp = serializeFilters(stored);
      // Préserve les autres params (?edit=…).
      const merged = new URLSearchParams(searchParams);
      sp.forEach((v, k) => merged.set(k, v));
      setSearchParams(merged, { replace: true });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (updater: Updater) => {
      setSearchParams(
        (prev) => {
          // On lit toujours l'état le plus récent depuis l'URL pour que des
          // mises à jour rapides successives (deux clics back-to-back) ne se
          // marchent pas dessus.
          const current = parseFilters(prev);
          const next =
            typeof updater === "function"
              ? (updater as (p: ListFilters) => ListFilters)(current)
              : updater;
          const sp = serializeFilters(next);
          const merged = new URLSearchParams();
          prev.forEach((v, k) => {
            if (!FILTER_KEYS.includes(k)) merged.set(k, v);
          });
          sp.forEach((v, k) => merged.set(k, v));
          try {
            window.localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(next));
          } catch {
            // ignore quota
          }
          return merged;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const patchFilters = useCallback(
    (patch: PatchUpdater) => {
      setFilters((prev) => {
        const p =
          typeof patch === "function"
            ? (patch as (f: ListFilters) => Partial<ListFilters>)(prev)
            : patch;
        return { ...prev, ...p };
      });
    },
    [setFilters],
  );

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

  return { filters, setFilters, patchFilters, reset };
}

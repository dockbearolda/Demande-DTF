import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import {
  COLUMN_DEFS,
  DEFAULT_SORT,
  DEFAULT_VISIBLE_COLUMNS,
  type ColumnId,
  type Density,
  type SortRule,
} from "../types";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

// ───────── Densité ─────────

export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "compact";
    const raw = window.localStorage.getItem(STORAGE_KEYS.density);
    return raw === "comfort" ? "comfort" : "compact";
  });
  const update = useCallback((d: Density) => {
    setDensity(d);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.density, d);
    }
  }, []);
  return [density, update];
}

// ───────── Colonnes visibles ─────────

const KNOWN_COLUMN_IDS = new Set(COLUMN_DEFS.map((c) => c.id));

function sanitizeColumns(ids: unknown): ColumnId[] {
  if (!Array.isArray(ids)) return DEFAULT_VISIBLE_COLUMNS.slice();
  const filtered = ids.filter(
    (id): id is ColumnId => typeof id === "string" && KNOWN_COLUMN_IDS.has(id as ColumnId),
  );
  // Garde-fou : on conserve toujours les colonnes obligatoires (non-optional).
  for (const c of COLUMN_DEFS) {
    if (!c.optional && !filtered.includes(c.id)) filtered.push(c.id);
  }
  return filtered;
}

export function useColumnVisibility(): [ColumnId[], (ids: ColumnId[]) => void] {
  const [columns, setColumns] = useState<ColumnId[]>(() =>
    sanitizeColumns(readJSON(STORAGE_KEYS.columns, DEFAULT_VISIBLE_COLUMNS)),
  );
  const update = useCallback((ids: ColumnId[]) => {
    const clean = sanitizeColumns(ids);
    setColumns(clean);
    writeJSON(STORAGE_KEYS.columns, clean);
  }, []);
  return [columns, update];
}

// ───────── Tri multi-colonne ─────────

export function useSortRules(): [SortRule[], (rules: SortRule[]) => void] {
  const [rules, setRules] = useState<SortRule[]>(() =>
    readJSON<SortRule[]>(STORAGE_KEYS.sort, DEFAULT_SORT),
  );
  const update = useCallback((next: SortRule[]) => {
    setRules(next);
    writeJSON(STORAGE_KEYS.sort, next);
  }, []);
  return [rules, update];
}

// ───────── Lignes dépliées (par session) ─────────

export function useExpandedRows(): {
  expanded: Set<string>;
  toggle: (id: string) => void;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;
} {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEYS.expanded);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEYS.expanded,
        JSON.stringify(Array.from(expanded)),
      );
    } catch {
      // ignore
    }
  }, [expanded]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: string[]) => {
    setExpanded(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  return { expanded, toggle, expandAll, collapseAll };
}

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import type { ColumnId, ListFilters, SavedView, SortRule } from "../types";

function readViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.views);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

function writeViews(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.views, JSON.stringify(views));
  } catch {
    // ignore
  }
}

export function useSavedViews(): {
  views: SavedView[];
  saveView: (
    name: string,
    snapshot: { filters: ListFilters; sort: SortRule[]; columns: ColumnId[] },
  ) => SavedView;
  deleteView: (id: string) => void;
  renameView: (id: string, name: string) => void;
} {
  const [views, setViews] = useState<SavedView[]>(() => readViews());

  const persist = useCallback((next: SavedView[]) => {
    setViews(next);
    writeViews(next);
  }, []);

  const saveView = useCallback(
    (
      name: string,
      snapshot: { filters: ListFilters; sort: SortRule[]; columns: ColumnId[] },
    ): SavedView => {
      const view: SavedView = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: name.trim() || "Vue sans nom",
        filters: snapshot.filters,
        sort: snapshot.sort,
        columns: snapshot.columns,
        createdAt: Date.now(),
      };
      const next = [...views, view];
      persist(next);
      return view;
    },
    [views, persist],
  );

  const deleteView = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
    },
    [views, persist],
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      persist(
        views.map((v) =>
          v.id === id ? { ...v, name: name.trim() || v.name } : v,
        ),
      );
    },
    [views, persist],
  );

  return { views, saveView, deleteView, renameView };
}

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Fuse from "fuse.js";

import type { SupplierModelDTO } from "@/hooks/useSupplierCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

// ─── Filter vocabulary ────────────────────────────────────────────────

export type Genre = "HOMME" | "FEMME" | "ENFANT" | "BEBE";
export type ProductType =
  | "tshirt"
  | "polo"
  | "sweat"
  | "hoodie"
  | "veste"
  | "debardeur"
  | "autre";
export type Material = "coton" | "polyester" | "melange";

export interface FilterState {
  search: string;
  genres: Set<Genre>;
  colorSlugs: Set<string>;
  types: Set<ProductType>;
  materials: Set<Material>;
}

// ─── URL serialisation ────────────────────────────────────────────────
//
// On encode chaque filtre dans un seul param URL pour que le lien reste
// lisible (?q=tshirt&g=H,F&col=blanc,noir…). Les sets sont sérialisés
// en CSV — choisi sur la simplicité de l'inspection du lien partagé.

const PARAM = {
  search: "q",
  genres: "g",
  colors: "col",
  types: "t",
  materials: "m",
} as const;

const GENRE_KEYS: Record<string, Genre> = {
  H: "HOMME",
  F: "FEMME",
  E: "ENFANT",
  B: "BEBE",
};
const GENRE_TO_KEY: Record<Genre, string> = {
  HOMME: "H",
  FEMME: "F",
  ENFANT: "E",
  BEBE: "B",
};

function readParamSet<T extends string>(
  params: URLSearchParams,
  key: string,
  decode: (raw: string) => T | null,
): Set<T> {
  const raw = params.get(key);
  if (!raw) return new Set();
  const out = new Set<T>();
  for (const part of raw.split(",")) {
    const v = decode(part.trim());
    if (v) out.add(v);
  }
  return out;
}

function writeParamSet<T extends string>(
  next: URLSearchParams,
  key: string,
  values: Set<T>,
  encode: (v: T) => string,
) {
  if (values.size === 0) {
    next.delete(key);
    return;
  }
  next.set(key, [...values].map(encode).join(","));
}

// ─── Type / material heuristics ───────────────────────────────────────
//
// Le DTO supplier ne porte ni un champ « type produit » ni un tag matière
// canonique : on les dérive côté client à partir de `name` / `ref_label`
// pour `type`, et de `fabric_composition` pour `material`. La couverture
// est volontairement permissive — un mot-clef suffit. À remplacer par un
// vrai champ structuré côté backend dès que le modèle de données évolue.

const TYPE_KEYWORDS: Record<ProductType, RegExp> = {
  tshirt: /\b(t[\s-]?shirt|tee)\b/i,
  polo: /\bpolo\b/i,
  sweat: /\bsweat(?!shirt)\b|\bsweatshirt\b/i,
  hoodie: /\b(hoodie|capuche|hooded)\b/i,
  veste: /\b(veste|jacket|softshell|coupe[\s-]?vent)\b/i,
  debardeur: /\b(d[ée]bardeur|tank[\s-]?top)\b/i,
  autre: /.^/, // never matches — fallback bucket
};

export function inferProductType(model: SupplierModelDTO): ProductType {
  const haystack = `${model.name ?? ""} ${model.ref_label} ${model.ref_supplier}`;
  for (const t of [
    "hoodie",
    "polo",
    "sweat",
    "tshirt",
    "veste",
    "debardeur",
  ] as ProductType[]) {
    if (TYPE_KEYWORDS[t].test(haystack)) return t;
  }
  return "autre";
}

export function inferMaterial(model: SupplierModelDTO): Material | null {
  const c = (model.fabric_composition ?? "").toLowerCase();
  if (!c) return null;
  const hasCotton = /coton|cotton/.test(c);
  const hasPoly = /polyester|polyamide/.test(c);
  if (hasCotton && hasPoly) return "melange";
  if (hasPoly) return "polyester";
  if (hasCotton) return "coton";
  // Mélanges autres (élasthanne, viscose…) → catégorie "mélange"
  return "melange";
}

// ─── Hook ─────────────────────────────────────────────────────────────

export interface CatalogFiltersResult {
  state: FilterState;
  /** Debounced version (200ms) du champ recherche — sert pour fuzzy match. */
  debouncedSearch: string;
  setSearch: (q: string) => void;
  toggleGenre: (g: Genre) => void;
  toggleColor: (slug: string) => void;
  toggleType: (t: ProductType) => void;
  toggleMaterial: (m: Material) => void;
  clearAll: () => void;
  /** True dès qu'au moins un filtre (hors `search`) ou la recherche est actif. */
  hasActiveFilters: boolean;
  /** Modèles qui satisfont l'ensemble des filtres en AND. */
  filteredModels: SupplierModelDTO[];
}

interface UseCatalogFiltersArgs {
  /** Tous les modèles disponibles (toutes catégories confondues). */
  allModels: SupplierModelDTO[];
  /** Synchroniser avec l'URL ou pas — utile pour désactiver pendant des
   *  démos hors route, ou pour des panels imbriqués. */
  syncUrl?: boolean;
}

export function useCatalogFilters({
  allModels,
  syncUrl = true,
}: UseCatalogFiltersArgs): CatalogFiltersResult {
  const [params, setParams] = useSearchParams();

  // ── State derived from URL on every render ─────────────────────────
  // On ne maintient PAS un useState miroir : la source de vérité est
  // `params`, pour éviter les boucles de sync et garder le state des
  // filtres déduplicable en un seul endroit (URL).

  const state: FilterState = useMemo(
    () => ({
      search: params.get(PARAM.search) ?? "",
      genres: readParamSet<Genre>(
        params,
        PARAM.genres,
        (k) => GENRE_KEYS[k.toUpperCase()] ?? null,
      ),
      colorSlugs: readParamSet<string>(params, PARAM.colors, (k) =>
        k.length > 0 ? k : null,
      ),
      types: readParamSet<ProductType>(params, PARAM.types, (k) => {
        const v = k.toLowerCase() as ProductType;
        return TYPE_KEYWORDS[v] ? v : null;
      }),
      materials: readParamSet<Material>(params, PARAM.materials, (k) => {
        const v = k.toLowerCase();
        return v === "coton" || v === "polyester" || v === "melange"
          ? (v as Material)
          : null;
      }),
    }),
    [params],
  );

  const debouncedSearch = useDebouncedValue(state.search.trim(), 200);

  // ── Mutators ──────────────────────────────────────────────────────
  const writeParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      if (!syncUrl) return;
      // `setParams` accepte un updater pour merger sans courses.
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        return next;
      });
    },
    [setParams, syncUrl],
  );

  const setSearch = useCallback(
    (q: string) => {
      writeParams((next) => {
        if (q.length === 0) next.delete(PARAM.search);
        else next.set(PARAM.search, q);
      });
    },
    [writeParams],
  );

  const toggleGenre = useCallback(
    (g: Genre) => {
      writeParams((next) => {
        const current = readParamSet<Genre>(
          next,
          PARAM.genres,
          (k) => GENRE_KEYS[k.toUpperCase()] ?? null,
        );
        if (current.has(g)) current.delete(g);
        else current.add(g);
        writeParamSet(next, PARAM.genres, current, (v) => GENRE_TO_KEY[v]);
      });
    },
    [writeParams],
  );

  const toggleColor = useCallback(
    (slug: string) => {
      writeParams((next) => {
        const current = readParamSet<string>(next, PARAM.colors, (k) =>
          k.length > 0 ? k : null,
        );
        if (current.has(slug)) current.delete(slug);
        else current.add(slug);
        writeParamSet(next, PARAM.colors, current, (v) => v);
      });
    },
    [writeParams],
  );

  const toggleType = useCallback(
    (t: ProductType) => {
      writeParams((next) => {
        const current = readParamSet<ProductType>(next, PARAM.types, (k) => {
          const v = k.toLowerCase() as ProductType;
          return TYPE_KEYWORDS[v] ? v : null;
        });
        if (current.has(t)) current.delete(t);
        else current.add(t);
        writeParamSet(next, PARAM.types, current, (v) => v);
      });
    },
    [writeParams],
  );

  const toggleMaterial = useCallback(
    (m: Material) => {
      writeParams((next) => {
        const current = readParamSet<Material>(next, PARAM.materials, (k) => {
          const v = k.toLowerCase();
          return v === "coton" || v === "polyester" || v === "melange"
            ? (v as Material)
            : null;
        });
        if (current.has(m)) current.delete(m);
        else current.add(m);
        writeParamSet(next, PARAM.materials, current, (v) => v);
      });
    },
    [writeParams],
  );

  const clearAll = useCallback(() => {
    writeParams((next) => {
      next.delete(PARAM.search);
      next.delete(PARAM.genres);
      next.delete(PARAM.colors);
      next.delete(PARAM.types);
      next.delete(PARAM.materials);
    });
  }, [writeParams]);

  // ── Pre-computed lookups (genre / type / material per model) ──────
  // On pré-calcule pour ne pas re-scanner les regex / la composition à
  // chaque frappe. Mémorisé sur l'identité de `allModels` — il change
  // peu (uniquement quand le catalogue est re-fetché).
  const modelMeta = useMemo(() => {
    const map = new Map<
      string,
      { type: ProductType; material: Material | null; colorSlugs: Set<string> }
    >();
    for (const m of allModels) {
      const colorSlugs = new Set<string>();
      for (const c of m.colors) {
        if (c.enabled) colorSlugs.add(c.slug);
      }
      map.set(m.id, {
        type: inferProductType(m),
        material: inferMaterial(m),
        colorSlugs,
      });
    }
    return map;
  }, [allModels]);

  const fuse = useMemo(
    () =>
      new Fuse(allModels, {
        keys: [
          { name: "ref_internal", weight: 0.9 },
          { name: "ref_supplier", weight: 1.0 },
          { name: "ref_label", weight: 0.7 },
          { name: "brand", weight: 0.5 },
          { name: "name", weight: 0.5 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [allModels],
  );

  // ── Filter pipeline ───────────────────────────────────────────────
  const filteredModels = useMemo(() => {
    // 1. Recherche texte (debounced) — appliquée d'abord car la plus sélective.
    const base =
      debouncedSearch.length >= 2
        ? fuse.search(debouncedSearch).map((r) => r.item)
        : allModels;

    return base.filter((m) => {
      const meta = modelMeta.get(m.id);
      if (!meta) return false;

      if (state.genres.size > 0 && !state.genres.has(m.category as Genre)) {
        return false;
      }
      if (state.types.size > 0 && !state.types.has(meta.type)) {
        return false;
      }
      if (state.materials.size > 0) {
        if (meta.material === null) return false;
        if (!state.materials.has(meta.material)) return false;
      }
      if (state.colorSlugs.size > 0) {
        // Le modèle doit posséder au moins une couleur active correspondant
        // aux slugs sélectionnés.
        let hasMatch = false;
        for (const slug of state.colorSlugs) {
          if (meta.colorSlugs.has(slug)) {
            hasMatch = true;
            break;
          }
        }
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [allModels, modelMeta, fuse, debouncedSearch, state]);

  const hasActiveFilters =
    state.search.length > 0 ||
    state.genres.size > 0 ||
    state.colorSlugs.size > 0 ||
    state.types.size > 0 ||
    state.materials.size > 0;

  // ── Auto-cleanup on unmount ───────────────────────────────────────
  // Quand le panel se ferme, on nettoie les params URL pour ne pas polluer
  // la route hôte (`/orders/new`) avec des filtres devenus invisibles. Le
  // deep-link reste possible : si l'utilisateur arrive avec des params,
  // ils sont lus dès le 1er render et survivent jusqu'au démontage.
  const cleanupOnUnmountRef = useRef(syncUrl);
  cleanupOnUnmountRef.current = syncUrl;
  useEffect(() => {
    return () => {
      if (!cleanupOnUnmountRef.current) return;
      // setParams peut tomber en post-unmount sur StrictMode dev — wrap.
      try {
        clearAll();
      } catch {
        // ignore
      }
    };
    // clearAll n'est PAS dans les deps : on veut un cleanup unique au démontage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    debouncedSearch,
    setSearch,
    toggleGenre,
    toggleColor,
    toggleType,
    toggleMaterial,
    clearAll,
    hasActiveFilters,
    filteredModels,
  };
}

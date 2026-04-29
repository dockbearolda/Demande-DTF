/**
 * Store Zustand pour Devis Flash v2 (squelette étape 3).
 *
 * Pas de persist ici — la persistance arrive à l'étape 5 quand l'entité
 * Quote sera créée backend. Pour l'instant, le store ne sert qu'à
 * piloter l'UI live.
 */
import { create } from "zustand";
import type { LogoPlacement } from "@/features/pricing";
import type { NeckType, SleeveType } from "@/lib/catalog";

export interface FlashDevisV2State {
  // Sélection / paramètres devis
  selectedModelRef: string | null;
  /** ID du client attaché au devis (FK vers clients.id côté backend). */
  selectedClientId: string | null;
  quantity: number;
  placements: Set<LogoPlacement>;
  transportActive: boolean;
  /** Override du tarif unitaire transport (€ TTC/unité). null = valeur admin. */
  transportTtcUnitOverride: number | null;
  tgcaActive: boolean;
  /** Remise commerciale TTC (montant fixe en €). 0 = pas de remise. */
  discount: number;
  notes: string;

  // Filtres col 1 (catalogue)
  sleeveFilter: Set<SleeveType>;
  neckFilter: Set<NeckType>;
  search: string;

  // ─── Setters ─────────────────────────────────────────────────────
  selectModel: (ref: string | null) => void;
  selectClient: (id: string | null) => void;
  setQuantity: (q: number) => void;
  togglePlacement: (p: LogoPlacement) => void;
  setTransportActive: (v: boolean) => void;
  setTransportTtcUnitOverride: (v: number | null) => void;
  setTgcaActive: (v: boolean) => void;
  setDiscount: (d: number) => void;
  setNotes: (s: string) => void;

  toggleSleeveFilter: (s: SleeveType) => void;
  toggleNeckFilter: (n: NeckType) => void;
  setSearch: (s: string) => void;

  reset: () => void;
}

const initial = {
  selectedModelRef: null as string | null,
  selectedClientId: null as string | null,
  quantity: 1,
  placements: new Set<LogoPlacement>(),
  transportActive: false,
  transportTtcUnitOverride: null as number | null,
  tgcaActive: false,
  discount: 0,
  notes: "",
  sleeveFilter: new Set<SleeveType>(),
  neckFilter: new Set<NeckType>(),
  search: "",
};

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export const useFlashDevisV2Store = create<FlashDevisV2State>((set) => ({
  ...initial,

  selectModel: (ref) => set({ selectedModelRef: ref }),
  selectClient: (id) => set({ selectedClientId: id }),
  setQuantity: (q) => set({ quantity: Number.isFinite(q) ? Math.max(1, Math.floor(q)) : 1 }),
  togglePlacement: (p) =>
    set((s) => ({ placements: toggleInSet(s.placements, p) })),
  setTransportActive: (v) => set({ transportActive: v }),
  setTransportTtcUnitOverride: (v) =>
    set({ transportTtcUnitOverride: v !== null && Number.isFinite(v) && v >= 0 ? v : null }),
  setTgcaActive: (v) => set({ tgcaActive: v }),
  setDiscount: (d) =>
    set({ discount: Number.isFinite(d) ? Math.max(0, d) : 0 }),
  setNotes: (s) => set({ notes: s }),

  toggleSleeveFilter: (v) =>
    set((s) => ({ sleeveFilter: toggleInSet(s.sleeveFilter, v) })),
  toggleNeckFilter: (v) =>
    set((s) => ({ neckFilter: toggleInSet(s.neckFilter, v) })),
  setSearch: (s) => set({ search: s }),

  reset: () =>
    set({
      selectedModelRef: null,
      selectedClientId: null,
      quantity: 1,
      placements: new Set(),
      transportActive: false,
      transportTtcUnitOverride: null,
      tgcaActive: false,
      discount: 0,
      notes: "",
      sleeveFilter: new Set(),
      neckFilter: new Set(),
      search: "",
    }),
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DiscountMode = "percent" | "amount";

export interface PricingTierFlash {
  minQty: number;
  vierge: number;
  coeur: number;
  dos: number;
}

export type PlacementType = "av" | "ar" | "av+ar" | "m1" | "m2";

export const PLACEMENT_LABELS: Record<PlacementType, string> = {
  av: "Logo Avant",
  ar: "Logo Arrière",
  "av+ar": "Av. + Ar.",
  m1: "Manche 1",
  m2: "Manche 2",
};

export interface FlashQuoteLine {
  id: string;
  reference: string;
  designation: string;
  prixUnitaire: number;
  quantite: number;
  placement?: PlacementType;
  /** Grille dégressi­ve du produit — permet l'auto-calcul du prix au changement de quantité. */
  pricingTiers?: PricingTierFlash[];
}

export interface FlashQuoteClient {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
}

export interface FlashQuoteState {
  quoteNumber: string | null;
  emittedAt: string;
  validUntil: string;
  client: FlashQuoteClient;
  lines: FlashQuoteLine[];
  discount: { mode: DiscountMode; value: number };
  vatRate: number;
  notes: string;

  setClient: (patch: Partial<FlashQuoteClient>) => void;
  setEmittedAt: (iso: string) => void;
  setValidUntil: (iso: string) => void;
  setNotes: (text: string) => void;

  addLine: (line: Omit<FlashQuoteLine, "id" | "quantite"> & { quantite?: number }) => void;
  /** Met à jour une ligne. Si seule la quantité change et que la ligne a des tiers, recalcule le prix. */
  updateLine: (id: string, patch: Partial<FlashQuoteLine>) => void;
  removeLine: (id: string) => void;

  setDiscountMode: (mode: DiscountMode) => void;
  setDiscountValue: (value: number) => void;
  setVatRate: (rate: number) => void;

  resetDraft: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const plus30Days = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const emptyClient: FlashQuoteClient = { nom: "", email: "", telephone: "", adresse: "" };

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `fq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useFlashQuoteStore = create<FlashQuoteState>()(
  persist(
    (set) => ({
      quoteNumber: null,
      emittedAt: today(),
      validUntil: plus30Days(),
      client: emptyClient,
      lines: [],
      discount: { mode: "percent", value: 0 },
      vatRate: 4,
      notes: "",

      setClient: (patch) => set((s) => ({ client: { ...s.client, ...patch } })),
      setEmittedAt: (iso) => set({ emittedAt: iso }),
      setValidUntil: (iso) => set({ validUntil: iso }),
      setNotes: (text) => set({ notes: text }),

      addLine: ({ reference, designation, prixUnitaire, quantite, pricingTiers }) =>
        set((s) => ({
          lines: [
            ...s.lines,
            {
              id: newId(),
              reference,
              designation,
              prixUnitaire,
              quantite: quantite ?? 1,
              pricingTiers,
            },
          ],
        })),

      updateLine: (id, patch) =>
        set((s) => ({
          lines: s.lines.map((l) => {
            if (l.id !== id) return l;
            const updated = { ...l, ...patch };
            // Auto-calcul du prix si seule la quantité change et que des tiers existent
            if ("quantite" in patch && !("prixUnitaire" in patch) && updated.pricingTiers?.length) {
              let best = updated.pricingTiers[0];
              for (const t of updated.pricingTiers) {
                if (t.minQty <= updated.quantite) best = t;
              }
              updated.prixUnitaire = best.vierge;
            }
            return updated;
          }),
        })),

      removeLine: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),

      setDiscountMode: (mode) => set((s) => ({ discount: { ...s.discount, mode } })),
      setDiscountValue: (value) =>
        set((s) => ({ discount: { ...s.discount, value: Math.max(0, value) } })),
      setVatRate: (rate) => set({ vatRate: Math.max(0, rate) }),

      resetDraft: () =>
        set({
          quoteNumber: null,
          emittedAt: today(),
          validUntil: plus30Days(),
          client: emptyClient,
          lines: [],
          discount: { mode: "percent", value: 0 },
          vatRate: 4,
          notes: "",
        }),
    }),
    {
      name: "oms.flashQuote.draft.v1",
    },
  ),
);

// ----- Computed selectors -----

export interface FlashQuoteTotals {
  subtotalHT: number;
  discountAmount: number;
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
}

export function computeTotals(state: {
  lines: FlashQuoteLine[];
  discount: { mode: DiscountMode; value: number };
  vatRate: number;
}): FlashQuoteTotals {
  const subtotalHT = state.lines.reduce(
    (acc, l) => acc + l.prixUnitaire * l.quantite,
    0,
  );
  const discountAmount =
    state.discount.mode === "percent"
      ? subtotalHT * (Math.min(100, state.discount.value) / 100)
      : Math.min(subtotalHT, state.discount.value);
  const totalHT = Math.max(0, subtotalHT - discountAmount);
  const vatAmount = totalHT * (state.vatRate / 100);
  const totalTTC = totalHT + vatAmount;
  return { subtotalHT, discountAmount, totalHT, vatAmount, totalTTC };
}

// ----- Quote numbering (client-side, localStorage-backed) -----

const COUNTER_KEY = "oms.flashQuote.counter.v1";

export function nextQuoteNumber(): string {
  const year = new Date().getFullYear();
  const raw = localStorage.getItem(COUNTER_KEY);
  let counter: { year: number; n: number } = { year, n: 0 };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { year: number; n: number };
      if (parsed.year === year) counter = parsed;
    } catch {
      // corrupt — start fresh
    }
  }
  counter.n += 1;
  localStorage.setItem(COUNTER_KEY, JSON.stringify(counter));
  const padded = String(counter.n).padStart(4, "0");
  return `DEVIS-${year}-${padded}`;
}

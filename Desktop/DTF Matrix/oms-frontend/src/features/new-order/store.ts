import { create } from "zustand";
import { TEXTILE_MODELS } from "./constants";
import type {
  ClassicLine,
  OperatorValue,
  OrderDraft,
  OrderHeader,
  OrderLine,
  Secteur,
  Target,
  TextileItem,
  TextileLine,
  ValidationResult,
} from "./types";
import { isClassicLine, isTextileLine } from "./types";

// ───────── Templates ─────────

const EMPTY_HEADER: OrderHeader = {
  clientId: null,
  clientNom: "",
  personneContact: "",
  telephone: "",
  assignedTo: "",
  dateLivraison: "",
  isUrgent: false,
  notes: "",
};

function blankLine(secteur: Secteur): OrderLine {
  if (secteur === "Textiles") {
    return {
      kind: "textile",
      target: "HOMME",
      modelId: "",
      modelName: "",
      items: {},
      design: {
        front: null,
        back: null,
        sleeves: null,
        skipped: false,
      },
    };
  }
  return {
    kind: "classic",
    secteur,
    produit: "",
    quantity: 0,
    prixUnitaire: 0,
  };
}

// ───────── Store shape ─────────

interface NewOrderState {
  draft: OrderDraft;

  // Header actions (never touch line)
  setHeader: (patch: Partial<OrderHeader>) => void;
  setClient: (id: string | null, nom: string, telephone?: string) => void;
  setAssignedTo: (v: OperatorValue | "") => void;
  setDateLivraison: (v: string) => void;
  toggleUrgent: () => void;
  setNotes: (v: string) => void;

  // Mode switch
  switchSecteur: (secteur: Secteur) => void;

  // Classic actions
  setClassicProduit: (produit: string, customProduit?: string) => void;
  setClassicQty: (quantity: number) => void;
  setClassicPrixUnitaire: (prixUnitaire: number) => void;

  // Textile actions
  setTextileTarget: (t: Target) => void;
  setTextileModel: (modelId: string) => void;
  upsertTextileItem: (item: TextileItem) => void;
  removeTextileItem: (id: string) => void;
  clearTextileItems: () => void;
  addPlaceholderItem: () => void;
  /** Append a new row (default color/size from current model). Returns new id. */
  addTextileRow: () => string | null;
  /** Patch a given row in-place (size, color, qty). */
  patchTextileItem: (id: string, patch: Partial<Omit<TextileItem, "id">>) => void;

  // Lifecycle
  reset: () => void;
  validate: () => ValidationResult;
}

// ───────── Helpers ─────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function currentSecteur(line: OrderLine | null): Secteur | null {
  if (!line) return null;
  return isClassicLine(line) ? line.secteur : "Textiles";
}

// ───────── Store ─────────

export const useNewOrderStore = create<NewOrderState>((set, get) => ({
  draft: { header: EMPTY_HEADER, line: null },

  setHeader: (patch) =>
    set((s) => ({ draft: { ...s.draft, header: { ...s.draft.header, ...patch } } })),

  setClient: (id, nom, telephone) =>
    set((s) => ({
      draft: {
        ...s.draft,
        header: {
          ...s.draft.header,
          clientId: id,
          clientNom: nom,
          telephone: telephone ?? s.draft.header.telephone,
        },
      },
    })),

  setAssignedTo: (v) =>
    set((s) => ({ draft: { ...s.draft, header: { ...s.draft.header, assignedTo: v } } })),

  setDateLivraison: (v) =>
    set((s) => ({ draft: { ...s.draft, header: { ...s.draft.header, dateLivraison: v } } })),

  toggleUrgent: () =>
    set((s) => ({
      draft: { ...s.draft, header: { ...s.draft.header, isUrgent: !s.draft.header.isUrgent } },
    })),

  setNotes: (v) =>
    set((s) => ({ draft: { ...s.draft, header: { ...s.draft.header, notes: v } } })),

  switchSecteur: (secteur) =>
    set((s) => {
      if (currentSecteur(s.draft.line) === secteur) return s;
      return { draft: { ...s.draft, line: blankLine(secteur) } };
    }),

  setClassicProduit: (produit, customProduit) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isClassicLine(line)) return s;
      const next: ClassicLine = { ...line, produit, customProduit };
      return { draft: { ...s.draft, line: next } };
    }),

  setClassicQty: (quantity) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isClassicLine(line)) return s;
      return { draft: { ...s.draft, line: { ...line, quantity } } };
    }),

  setClassicPrixUnitaire: (prixUnitaire) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isClassicLine(line)) return s;
      return { draft: { ...s.draft, line: { ...line, prixUnitaire } } };
    }),

  setTextileTarget: (t) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      // Reset model car dépend de la cible
      const next: TextileLine = {
        ...line,
        target: t,
        modelId: "",
        modelName: "",
        items: {},
      };
      return { draft: { ...s.draft, line: next } };
    }),

  setTextileModel: (modelId) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      const model = TEXTILE_MODELS.find((m) => m.id === modelId);
      if (!model) return s;
      return {
        draft: {
          ...s.draft,
          line: {
            ...line,
            modelId,
            modelName: model.name,
            // Le genre est implicite dans la référence produit
            target: model.target,
            items: {}, // reset matrix quand on change de modèle
          },
        },
      };
    }),

  upsertTextileItem: (item) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      const next = { ...line.items };
      if (item.qty <= 0) delete next[item.id];
      else next[item.id] = item;
      return { draft: { ...s.draft, line: { ...line, items: next } } };
    }),

  removeTextileItem: (id) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      const next = { ...line.items };
      delete next[id];
      return { draft: { ...s.draft, line: { ...line, items: next } } };
    }),

  clearTextileItems: () =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      return { draft: { ...s.draft, line: { ...line, items: {} } } };
    }),

  addPlaceholderItem: () =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      const id = genId();
      const item: TextileItem = {
        id,
        size: "__ANY__",
        color: "__ANY__",
        qty: 1,
        isPlaceholder: true,
      };
      return {
        draft: { ...s.draft, line: { ...line, items: { ...line.items, [id]: item } } },
      };
    }),

  addTextileRow: () => {
    const state = get();
    const line = state.draft.line;
    if (!line || !isTextileLine(line)) return null;
    const model = TEXTILE_MODELS.find((m) => m.id === line.modelId);
    if (!model) return null;
    const defaultColor = model.colors[0]?.id ?? "";
    const defaultSize = [...model.sizes].sort((a, b) => a.order - b.order)[0]?.id ?? "";
    const id = genId();
    const item: TextileItem = {
      id,
      size: defaultSize,
      color: defaultColor,
      qty: 0,
    };
    set((s) => {
      const l = s.draft.line;
      if (!l || !isTextileLine(l)) return s;
      return { draft: { ...s.draft, line: { ...l, items: { ...l.items, [id]: item } } } };
    });
    return id;
  },

  patchTextileItem: (id, patch) =>
    set((s) => {
      const line = s.draft.line;
      if (!line || !isTextileLine(line)) return s;
      const existing = line.items[id];
      if (!existing) return s;
      const next: TextileItem = { ...existing, ...patch, id };
      return { draft: { ...s.draft, line: { ...line, items: { ...line.items, [id]: next } } } };
    }),

  reset: () =>
    set({ draft: { header: EMPTY_HEADER, line: null } }),

  validate: () => {
    const { header, line } = get().draft;
    const fieldErrors: ValidationResult["fieldErrors"] = {};
    if (!header.clientNom.trim()) fieldErrors.clientNom = "Client requis";
    if (!header.assignedTo) fieldErrors.assignedTo = "Opérateur requis";
    if (!line) {
      fieldErrors.secteur = "Secteur requis";
    } else if (isClassicLine(line)) {
      const produit = line.customProduit?.trim() || line.produit;
      if (!produit) fieldErrors.line = "Produit requis";
      else if (!line.quantity || line.quantity <= 0)
        fieldErrors.line = "Quantité requise";
    } else if (isTextileLine(line)) {
      if (!line.modelId) fieldErrors.line = "Modèle requis";
      else if (Object.keys(line.items).length === 0)
        fieldErrors.line = "Ajouter au moins une taille";
    }
    return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
  },
}));

// ───────── Scoped selectors (évitent re-renders inutiles) ─────────

export const selectHeader = (s: NewOrderState) => s.draft.header;
export const selectLine = (s: NewOrderState) => s.draft.line;
export const selectSecteur = (s: NewOrderState) => currentSecteur(s.draft.line);

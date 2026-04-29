import { create } from "zustand";
import { pushRecentClientId } from "@/lib/recentClients";
import { getTextileModel } from "./runtimeCatalog";
import type {
  BatDraft,
  BatMode,
  BodyPlacement,
  ClassicLine,
  LinkedBatRef,
  OperatorValue,
  OrderDraft,
  OrderHeader,
  OrderLine,
  OrderLineRecord,
  PlacementId,
  Secteur,
  SleevePlacement,
  Target,
  TextileItem,
  TextileLine,
  ValidationResult,
} from "./types";
// `BatDraft` is referenced by stripBlobsForPersistence — re-export-style usage.
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
      logoPlacement: "front-center" as PlacementId,
      bodyPlacements: ["front"],
      sleeveLogoPlacements: [],
      // Hypothèse par défaut : le client garde la même configuration de
      // marquage sur toutes les couleurs d'articles. L'utilisateur la décoche
      // explicitement quand il veut adapter la couleur du logo au vêtement.
      hasIdenticalLogoSetup: true,
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

function blankRecord(secteur: Secteur): OrderLineRecord {
  return { id: genId(), line: blankLine(secteur) };
}

// ───────── Store shape ─────────

export type WizardStep = 1 | 2 | 3 | 4;

interface NewOrderState {
  draft: OrderDraft;
  currentStep: WizardStep;
  /** Server-side draft id (uuid). Lazily generated when the user first
   *  enters meaningful data — prevents creating empty files on disk. */
  draftId: string | null;

  setDraftId: (id: string | null) => void;
  /** Replace the entire wizard state from a stored draft payload — used by
   *  the Brouillons page when the user clicks « Reprendre ». */
  hydrateFromDraft: (snapshot: {
    draft: OrderDraft;
    currentStep: WizardStep;
    draftId: string;
  }) => void;

  // Wizard navigation (kept for OrderForm legacy paths)
  setStep: (step: WizardStep) => void;
  goNextStep: () => void;
  goPrevStep: () => void;
  validateStep: (step: WizardStep) => ValidationResult;

  // Header actions
  setHeader: (patch: Partial<OrderHeader>) => void;
  setClient: (id: string | null, nom: string, telephone?: string) => void;
  setAssignedTo: (v: OperatorValue | "") => void;
  setDateLivraison: (v: string) => void;
  toggleUrgent: () => void;
  setNotes: (v: string) => void;

  // ─── Multi-line management ────────────────────────────────────────
  /** Append a new blank line of the given secteur, expand it, collapse others.
   *  Returns the new line id. */
  addLine: (secteur: Secteur) => string;
  /** Remove a line by id. If it was expanded, expands the previous one (if any). */
  removeLine: (id: string) => void;
  /** Deep-clone a line under a fresh id, expand the duplicate. */
  duplicateLine: (id: string) => string | null;
  /** Expand a line (and collapse all others). */
  expandLine: (id: string) => void;
  /** Collapse the currently-expanded line — no line is expanded. */
  collapseAll: () => void;
  /** Reorder by moving the line at fromIdx to toIdx. */
  reorderLines: (fromIdx: number, toIdx: number) => void;
  /** Copy the artwork (TextileDesign + bodyPlacements + batDrafts) from one
   *  textile line to one or more target textile lines. */
  copyArtworkToLines: (sourceId: string, targetIds: string[]) => void;
  /** Returns indexes of lines that share the same (productRef, color, size)
   *  signature — used to surface a merge dialog after editing a line. */
  findDuplicates: (id: string) => string[];

  // Mode switch (compat for legacy mono-line flow — operates on expanded line)
  switchSecteur: (secteur: Secteur) => void;

  // Classic actions (operate on expanded line)
  setClassicProduit: (produit: string, customProduit?: string) => void;
  setClassicQty: (quantity: number) => void;
  setClassicPrixUnitaire: (prixUnitaire: number) => void;

  // Sourcing spécial (hors catalogue) — opèrent sur la ligne dépliée.
  /** Active ou désactive le mode sourcing. Quand true, la ligne est traitée
   *  comme un article hors catalogue (prix facultatif, badge dédié, statut
   *  commande auto-promu en EN_ATTENTE_SOURCING). */
  setClassicSourcingRequired: (value: boolean) => void;
  setClassicSourcingDescription: (description: string) => void;
  setClassicSourcingBudget: (budget: number | null) => void;

  // Textile actions (operate on expanded line)
  setTextileTarget: (t: Target) => void;
  setTextileModel: (modelId: string) => void;
  upsertTextileItem: (item: TextileItem) => void;
  removeTextileItem: (id: string) => void;
  clearTextileItems: () => void;
  addPlaceholderItem: () => void;
  addTextileRow: () => string | null;
  addTextileRowForColor: (colorId: string) => string | null;
  patchTextileItem: (id: string, patch: Partial<Omit<TextileItem, "id">>) => void;
  /** Change the color of an existing row (= every item that currently uses
   *  `oldColorId`). Rekeys items, BAT drafts and linked BATs from old → new
   *  color id. No-op if the new color is already used by another row. */
  changeTextileRowColor: (oldColorId: string, newColorId: string) => boolean;
  /** Sélectionne un emplacement de logo (single-select). Met à jour logoPlacement,
   *  bodyPlacements et sleeveLogoPlacements de façon cohérente. */
  setLogoPlacement: (id: PlacementId) => void;
  /** Active/désactive un placement corps (avant/arrière) — cumulatif. */
  toggleBodyPlacement: (placement: BodyPlacement) => void;
  setBodyPlacements: (placements: BodyPlacement[]) => void;
  /** Active/désactive un placement manche — cumulatif. */
  toggleSleevePlacement: (placement: SleevePlacement) => void;
  setSleeveLogoPlacements: (sleeves: SleevePlacement[]) => void;
  /** Indique si le calage logo est commun à toutes les couleurs d'articles
   *  (true = un seul setup machine, false = un setup par couleur d'article). */
  setIdenticalLogoSetup: (value: boolean) => void;
  /** Définit / efface le prix unitaire saisi manuellement par l'utilisateur sur
   *  l'étape « Demande ». null = retour au prix auto-calculé. */
  setTextilePrixUnitaireOverride: (value: number | null) => void;
  setBatDraft: (draft: BatDraft | null) => void;
  addBatVersionForColor: (
    colorId: string,
    draft: Omit<BatDraft, "version" | "colorId">,
  ) => BatDraft;
  clearBatVersionsForColor: (colorId: string) => void;
  setBatMode: (mode: BatMode) => void;
  linkBatForColor: (colorId: string, ref: LinkedBatRef) => void;
  unlinkBatForColor: (colorId: string) => void;
  setDeferBat: (defer: boolean) => void;
  /** Variante line-scoped — opère sur la ligne ciblée par id (pas seulement
   *  l'expandée). Utilisée par le menu kebab de ReferenceRow à l'étape 2 pour
   *  marquer/réactiver une référence sans avoir à la déplier. */
  setLineDeferBat: (lineId: string, defer: boolean) => void;
  /** Définit la décision de personnalisation pour une référence textile.
   *  "with"  → la référence doit recevoir un BAT (deferBat=false).
   *  "without" → référence sans marquage (deferBat=true), aucun BAT requis. */
  setLinePersonalizationMode: (lineId: string, mode: "with" | "without") => void;
  /** Bascule **toutes** les références textiles dans le mode donné (utilisé
   *  par le bouton « Tout sans perso » pour les commandes blanches massives). */
  setAllPersonalizationMode: (mode: "with" | "without") => void;
  /** Efface tous les BAT (drafts + linkedBats) d'une ligne donnée et remet
   *  `deferBat` à false. Utilisé par "Réinitialiser le BAT" du kebab. */
  resetLineBat: (lineId: string) => void;

  // ─── Resume previous order ───────────────────────────────────────
  /** Replace the draft's lines with a pre-filled set (typically rebuilt from
   *  a previous order). Keeps the current header (client must already be
   *  selected) and jumps the wizard to the requested step. Collapses every
   *  line so the user lands on a clean overview. */
  loadFromOrder: (records: OrderLineRecord[], targetStep?: WizardStep) => void;

  // Lifecycle
  /** Clears the currently expanded line's content (kind/secteur/items…). */
  clearLine: () => void;
  /** Resets the expanded line to "no line" — keeps header. Used when the user
   *  cancels a line without picking a category. */
  resetLine: () => void;
  /** Resets everything (header + all lines). */
  reset: () => void;
  /** Validate the whole draft (header + at least one valid line). */
  validate: () => ValidationResult;
}

// ───────── Helpers ─────────

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function currentSecteurOf(line: OrderLine | null): Secteur | null {
  if (!line) return null;
  return isClassicLine(line) ? line.secteur : "Textiles";
}

function findLine(records: OrderLineRecord[], id: string | null): OrderLineRecord | null {
  if (!id) return null;
  return records.find((r) => r.id === id) ?? null;
}

function expandedLine(state: NewOrderState): OrderLine | null {
  const r = findLine(state.draft.lines, state.draft.expandedLineId);
  return r ? r.line : null;
}

/** Replace the expanded line via a patch fn, no-op if no line is expanded. */
function patchExpanded(
  s: NewOrderState,
  patcher: (line: OrderLine) => OrderLine | null,
): NewOrderState {
  const id = s.draft.expandedLineId;
  if (!id) return s;
  const records = s.draft.lines.map((r) => {
    if (r.id !== id) return r;
    const next = patcher(r.line);
    return next ? { ...r, line: next } : r;
  });
  return { ...s, draft: { ...s.draft, lines: records } };
}

/** Build a stable signature for duplicate detection. */
function lineSignature(line: OrderLine): string {
  if (isClassicLine(line)) {
    const produit = (line.customProduit?.trim() || line.produit).toLowerCase();
    return `classic:${line.secteur}:${produit}`;
  }
  if (isTextileLine(line)) {
    const items = Object.values(line.items)
      .filter((it) => !it.isPlaceholder)
      .map((it) => `${it.color}/${it.size}`)
      .sort()
      .join(",");
    return `textile:${line.modelId}:${items}`;
  }
  return "";
}

// ───────── Persistence ─────────

const STORAGE_KEY = "dtf:new-order:draft:v4";
// v3 → v4 : insertion d'une étape Client en tête (currentStep décale de 1).
// Plutôt que de migrer le numéro persisté, on jette le draft v3 — coût faible
// (saisie locale uniquement) et garantit que l'utilisateur ne se retrouve pas
// sur la mauvaise étape avec un sens différent.
const LEGACY_STORAGE_KEYS = [
  "dtf:new-order:draft:v3",
  "dtf:new-order:draft:v2",
  "dtf:new-order:draft",
];

interface PersistedShape {
  draft: OrderDraft;
  currentStep: WizardStep;
  draftId?: string | null;
}

function loadPersisted(): PersistedShape | null {
  if (typeof window === "undefined") return null;
  try {
    // Older versions (v1, v2) are dropped silently — the placement schema
    // changed (logoPlacement → bodyPlacements[]) and migrating shapes would
    // risk producing inconsistent state.
    for (const k of LEGACY_STORAGE_KEYS) {
      if (window.localStorage.getItem(k)) {
        window.localStorage.removeItem(k);
      }
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.draft || typeof parsed.draft !== "object") return null;
    if (!Array.isArray(parsed.draft.lines)) return null;
    if (![1, 2, 3, 4].includes(parsed.currentStep)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Strip heavy blobs (BAT PDF base64, mockup/logo dataUrls) before persisting.
 *  Blobs stay in-memory for the active session; on reload the user re-uploads
 *  or the BAT is fetched from the backend. This keeps localStorage well under
 *  the 5-10 MB browser quota even with many references and avoids JSON.stringify
 *  dominating each keystroke's frame budget. */
function stripBlobsForPersistence(draft: OrderDraft): OrderDraft {
  const cleanLine = (line: OrderLine): OrderLine => {
    if (!isTextileLine(line)) return line;
    const next: TextileLine = { ...line };
    if (next.batDraft) {
      next.batDraft = { ...next.batDraft, pdfBase64: "" };
    }
    if (next.batDrafts) {
      const cleanedMap: Record<string, BatDraft[]> = {};
      for (const [color, versions] of Object.entries(next.batDrafts)) {
        cleanedMap[color] = versions.map((d) => ({ ...d, pdfBase64: "" }));
      }
      next.batDrafts = cleanedMap;
    }
    if (next.design) {
      const cleanSide = (side: TextileLine["design"]["front"]) =>
        side
          ? { ...side, mockupDataUrl: null, logoDataUrl: null }
          : side;
      next.design = {
        ...next.design,
        front: cleanSide(next.design.front),
        back: cleanSide(next.design.back),
        sleeves: cleanSide(next.design.sleeves),
      };
    }
    return next;
  };
  return {
    ...draft,
    lines: draft.lines.map((r) => ({ ...r, line: cleanLine(r.line) })),
  };
}

function savePersisted(state: PersistedShape) {
  if (typeof window === "undefined") return;
  try {
    const slim: PersistedShape = {
      ...state,
      draft: stripBlobsForPersistence(state.draft),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    // ignore quota / serialization errors
  }
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ───────── Per-step validation ─────────

function validateOneLine(line: OrderLine | null): string | null {
  if (!line) return "Catégorie requise";
  if (isClassicLine(line)) {
    const produit = line.customProduit?.trim() || line.produit;
    if (!produit) return "Produit requis";
    if (!line.quantity || line.quantity <= 0) return "Quantité requise";
    // Sourcing spécial — la description détaillée est obligatoire ; sans elle,
    // l'équipe achat ne peut pas exécuter le sourcing. On n'exige PAS le prix
    // unitaire (renseigné a posteriori par un manager).
    if (line.isSourcingRequired) {
      const desc = line.sourcingDescription?.trim();
      if (!desc) return "Description sourcing requise";
    }
    return null;
  }
  if (isTextileLine(line)) {
    if (!line.modelId) return "Modèle requis";
    const hasItems = Object.values(line.items).some(
      (it) => !it.isPlaceholder && it.qty > 0,
    );
    if (!hasItems) return "Ajouter au moins une taille avec quantité";
    return null;
  }
  return null;
}

function validateLineStep(line: OrderLine | null): ValidationResult {
  const fieldErrors: ValidationResult["fieldErrors"] = {};
  const err = validateOneLine(line);
  if (err) {
    if (!line) fieldErrors.secteur = err;
    else fieldErrors.line = err;
  }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

/** Dérive la décision de personnalisation effective d'une ligne textile.
 *  Source de vérité = `personalizationMode` ; à défaut on tente une
 *  rétro-compatibilité raisonnable pour les drafts persistés avant
 *  l'introduction du toggle (deferBat=true → "without", BAT existant →
 *  "with"). Retourne null quand l'utilisateur n'a encore rien tranché. */
export function effectivePersonalizationMode(
  line: TextileLine,
): "with" | "without" | null {
  if (line.personalizationMode === "with") return "with";
  if (line.personalizationMode === "without") return "without";
  if (line.deferBat) return "without";
  const hasDraft = Object.values(line.batDrafts ?? {}).some(
    (arr) => (arr?.length ?? 0) > 0,
  );
  const hasLinked = Object.keys(line.linkedBats ?? {}).length > 0;
  if (hasDraft || hasLinked) return "with";
  return null;
}

function validateCustomizationStep(
  _records: OrderLineRecord[],
): ValidationResult {
  return { ok: true, fieldErrors: {} };
}

/** Étape 1 — Client. L'opérateur est défini par la session ouverte sur le
 *  poste (cf. SessionGate) et auto-injecté côté payload, donc aucune
 *  validation UI à ce stade. */
function validateClientStep(header: OrderHeader): ValidationResult {
  const fieldErrors: ValidationResult["fieldErrors"] = {};
  if (!header.clientNom.trim()) {
    fieldErrors.clientNom = "Client requis";
  } else if (!header.clientId) {
    // Le nom est saisi mais aucune fiche client n'est rattachée — on force
    // l'utilisateur à sélectionner une suggestion ou à créer la fiche.
    fieldErrors.clientNom = "Sélectionne un client existant ou crée la fiche";
  }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

/** Étape 4 — Livraison. Date / urgent / note sont tous optionnels (la date
 *  par défaut est calculée côté backend) — le client + l'opérateur sont déjà
 *  validés en étape 1, donc plus rien de bloquant ici. */
function validateDeliveryStep(_header: OrderHeader): ValidationResult {
  return { ok: true, fieldErrors: {} };
}

// ───────── Initial state ─────────

const persisted = loadPersisted();
const INITIAL_DRAFT: OrderDraft = persisted?.draft ?? {
  header: EMPTY_HEADER,
  lines: [],
  expandedLineId: null,
};
const INITIAL_STEP: WizardStep = persisted?.currentStep ?? 1;
const INITIAL_DRAFT_ID: string | null = persisted?.draftId ?? null;

// ───────── Store ─────────

export const useNewOrderStore = create<NewOrderState>((set, get) => ({
  draft: INITIAL_DRAFT,
  currentStep: INITIAL_STEP,
  draftId: INITIAL_DRAFT_ID,

  setDraftId: (id) => set({ draftId: id }),

  hydrateFromDraft: (snapshot) =>
    set({
      draft: snapshot.draft,
      currentStep: snapshot.currentStep,
      draftId: snapshot.draftId,
    }),

  setStep: (step) => set({ currentStep: step }),

  goNextStep: () => {
    const { currentStep } = get();
    if (currentStep < 4) set({ currentStep: (currentStep + 1) as WizardStep });
  },

  goPrevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) set({ currentStep: (currentStep - 1) as WizardStep });
  },

  validateStep: (step) => {
    const state = get();
    const { draft } = state;
    if (step === 1) return validateClientStep(draft.header);
    if (step === 2) {
      // Aucune ligne dépliée mais des lignes existent (slot virtuel "Nouvelle
      // référence" affiché) → l'utilisateur a déjà saisi des références
      // valides, on l'autorise à passer à l'étape suivante sans forcer la
      // saisie du slot vide.
      if (draft.expandedLineId === null && draft.lines.length > 0) {
        const allValid = draft.lines.every((r) => validateOneLine(r.line) === null);
        if (allValid) return { ok: true, fieldErrors: {} };
      }
      return validateLineStep(expandedLine(state));
    }
    if (step === 3) return validateCustomizationStep(draft.lines);
    return validateDeliveryStep(draft.header);
  },

  setHeader: (patch) =>
    set((s) => ({ draft: { ...s.draft, header: { ...s.draft.header, ...patch } } })),

  setClient: (id, nom, telephone) =>
    set((s) => {
      const prev = s.draft.header;
      const shouldAutofillContact =
        !prev.personneContact.trim() || prev.personneContact === prev.clientNom;
      if (id) pushRecentClientId(id);
      return {
        draft: {
          ...s.draft,
          header: {
            ...prev,
            clientId: id,
            clientNom: nom,
            telephone: telephone ?? prev.telephone,
            personneContact: shouldAutofillContact ? nom : prev.personneContact,
          },
        },
      };
    }),

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

  // ─── Multi-line management ────────────────────────────────────────

  addLine: (secteur) => {
    const record = blankRecord(secteur);
    set((s) => ({
      draft: {
        ...s.draft,
        lines: [...s.draft.lines, record],
        expandedLineId: record.id,
      },
    }));
    return record.id;
  },

  removeLine: (id) =>
    set((s) => {
      const idx = s.draft.lines.findIndex((r) => r.id === id);
      if (idx < 0) return s;
      const next = s.draft.lines.filter((r) => r.id !== id);
      let nextExpanded: string | null = s.draft.expandedLineId;
      if (s.draft.expandedLineId === id) {
        nextExpanded =
          next[idx]?.id ?? next[idx - 1]?.id ?? next[0]?.id ?? null;
      }
      return {
        draft: { ...s.draft, lines: next, expandedLineId: nextExpanded },
      };
    }),

  duplicateLine: (id) => {
    const state = get();
    const idx = state.draft.lines.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const source = state.draft.lines[idx];
    // Deep clone via JSON — items/design/batDrafts are plain data, no Map/Date.
    const cloned: OrderLine = JSON.parse(JSON.stringify(source.line));
    const newRecord: OrderLineRecord = { id: genId(), line: cloned };
    set((s) => {
      const before = s.draft.lines.slice(0, idx + 1);
      const after = s.draft.lines.slice(idx + 1);
      return {
        draft: {
          ...s.draft,
          lines: [...before, newRecord, ...after],
          expandedLineId: newRecord.id,
        },
      };
    });
    return newRecord.id;
  },

  expandLine: (id) =>
    set((s) => ({ draft: { ...s.draft, expandedLineId: id } })),

  collapseAll: () =>
    set((s) => ({ draft: { ...s.draft, expandedLineId: null } })),

  reorderLines: (fromIdx, toIdx) =>
    set((s) => {
      if (fromIdx === toIdx) return s;
      const arr = [...s.draft.lines];
      if (fromIdx < 0 || fromIdx >= arr.length) return s;
      const [moved] = arr.splice(fromIdx, 1);
      const dest = Math.max(0, Math.min(arr.length, toIdx));
      arr.splice(dest, 0, moved);
      return { draft: { ...s.draft, lines: arr } };
    }),

  copyArtworkToLines: (sourceId, targetIds) =>
    set((s) => {
      const source = s.draft.lines.find((r) => r.id === sourceId);
      if (!source || !isTextileLine(source.line)) return s;
      const src = source.line;
      const cloned = (): Pick<TextileLine, "design" | "bodyPlacements" | "sleeveLogoPlacements" | "batDrafts" | "batDraft" | "batMode" | "linkedBats"> => ({
        design: JSON.parse(JSON.stringify(src.design)),
        bodyPlacements: [...(src.bodyPlacements ?? [])],
        sleeveLogoPlacements: src.sleeveLogoPlacements ? [...src.sleeveLogoPlacements] : [],
        batDrafts: src.batDrafts ? JSON.parse(JSON.stringify(src.batDrafts)) : undefined,
        batDraft: src.batDraft ? JSON.parse(JSON.stringify(src.batDraft)) : null,
        batMode: src.batMode,
        linkedBats: src.linkedBats ? JSON.parse(JSON.stringify(src.linkedBats)) : undefined,
      });
      const targets = new Set(targetIds);
      const next = s.draft.lines.map((r) => {
        if (!targets.has(r.id) || !isTextileLine(r.line)) return r;
        return { ...r, line: { ...r.line, ...cloned() } };
      });
      return { draft: { ...s.draft, lines: next } };
    }),

  findDuplicates: (id) => {
    const state = get();
    const target = state.draft.lines.find((r) => r.id === id);
    if (!target) return [];
    const sig = lineSignature(target.line);
    if (!sig) return [];
    return state.draft.lines
      .filter((r) => r.id !== id && lineSignature(r.line) === sig)
      .map((r) => r.id);
  },

  switchSecteur: (secteur) =>
    set((s) => {
      const id = s.draft.expandedLineId;
      // No line expanded → create one.
      if (!id) {
        const record = blankRecord(secteur);
        return {
          draft: {
            ...s.draft,
            lines: [...s.draft.lines, record],
            expandedLineId: record.id,
          },
        };
      }
      // Same secteur → no-op.
      const cur = findLine(s.draft.lines, id);
      if (cur && currentSecteurOf(cur.line) === secteur) return s;
      // Otherwise replace the expanded line's content with a new blank one of
      // the requested secteur. The id is preserved so the accordion keeps its
      // place in the list.
      const lines = s.draft.lines.map((r) =>
        r.id === id ? { ...r, line: blankLine(secteur) } : r,
      );
      return { draft: { ...s.draft, lines } };
    }),

  setClassicProduit: (produit, customProduit) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isClassicLine(line)) return null;
        const next: ClassicLine = { ...line, produit, customProduit };
        return next;
      }),
    ),

  setClassicQty: (quantity) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isClassicLine(line) ? { ...line, quantity } : null,
      ),
    ),

  setClassicPrixUnitaire: (prixUnitaire) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isClassicLine(line) ? { ...line, prixUnitaire } : null,
      ),
    ),

  setClassicSourcingRequired: (value) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isClassicLine(line)) return null;
        if (!value) {
          // Désactivation : on nettoie les champs sourcing pour ne pas
          // conserver de données orphelines dans le draft persisté.
          const next: ClassicLine = { ...line, isSourcingRequired: false };
          delete next.sourcingDescription;
          delete next.sourcingBudgetEstime;
          return next;
        }
        // Activation : on force le secteur "Autres" (catégorie sourcing) et
        // on remet le prix à 0 — il sera chiffré plus tard par un manager.
        return {
          ...line,
          isSourcingRequired: true,
          secteur: "Autres",
          prixUnitaire: 0,
        };
      }),
    ),

  setClassicSourcingDescription: (description) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isClassicLine(line)
          ? { ...line, sourcingDescription: description }
          : null,
      ),
    ),

  setClassicSourcingBudget: (budget) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isClassicLine(line)) return null;
        if (budget === null || budget === undefined || Number.isNaN(budget)) {
          const next = { ...line };
          delete next.sourcingBudgetEstime;
          return next;
        }
        return { ...line, sourcingBudgetEstime: budget };
      }),
    ),

  setTextileTarget: (t) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        return { ...line, target: t, modelId: "", modelName: "", items: {} };
      }),
    ),

  setTextileModel: (modelId) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const model = getTextileModel(modelId);
        if (!model) return null;
        return {
          ...line,
          modelId,
          modelName: model.name,
          target: model.target,
          items: {},
        };
      }),
    ),

  upsertTextileItem: (item) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const next = { ...line.items };
        if (item.qty <= 0) delete next[item.id];
        else next[item.id] = item;
        return { ...line, items: next };
      }),
    ),

  removeTextileItem: (id) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const next = { ...line.items };
        delete next[id];
        return { ...line, items: next };
      }),
    ),

  clearTextileItems: () =>
    set((s) =>
      patchExpanded(s, (line) =>
        isTextileLine(line) ? { ...line, items: {} } : null,
      ),
    ),

  addPlaceholderItem: () =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const id = genId();
        const item: TextileItem = {
          id,
          size: "__ANY__",
          color: "__ANY__",
          qty: 1,
          isPlaceholder: true,
        };
        return { ...line, items: { ...line.items, [id]: item } };
      }),
    ),

  addTextileRow: () => {
    const state = get();
    const line = expandedLine(state);
    if (!line || !isTextileLine(line)) return null;
    const model = getTextileModel(line.modelId);
    if (!model) return null;
    const defaultColor = model.colors[0]?.id ?? "";
    const defaultSize = [...model.sizes].sort((a, b) => a.order - b.order)[0]?.id ?? "";
    const id = genId();
    const item: TextileItem = { id, size: defaultSize, color: defaultColor, qty: 0 };
    set((s) =>
      patchExpanded(s, (l) =>
        isTextileLine(l) ? { ...l, items: { ...l.items, [id]: item } } : null,
      ),
    );
    return id;
  },

  addTextileRowForColor: (colorId) => {
    const state = get();
    const line = expandedLine(state);
    if (!line || !isTextileLine(line)) return null;
    const model = getTextileModel(line.modelId);
    if (!model) return null;
    const sortedSizes = [...model.sizes].sort((a, b) => a.order - b.order);
    const usedSizes = new Set(
      Object.values(line.items)
        .filter((it) => it.color === colorId && !it.isPlaceholder)
        .map((it) => it.size),
    );
    const nextSize =
      sortedSizes.find((sz) => !usedSizes.has(sz.id))?.id ?? sortedSizes[0]?.id ?? "";
    const id = genId();
    const item: TextileItem = { id, size: nextSize, color: colorId, qty: 1 };
    set((s) =>
      patchExpanded(s, (l) =>
        isTextileLine(l) ? { ...l, items: { ...l.items, [id]: item } } : null,
      ),
    );
    return id;
  },

  patchTextileItem: (id, patch) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const existing = line.items[id];
        if (!existing) return null;
        const next: TextileItem = { ...existing, ...patch, id };
        return { ...line, items: { ...line.items, [id]: next } };
      }),
    ),

  changeTextileRowColor: (oldColorId, newColorId) => {
    if (oldColorId === newColorId) return false;
    const state = get();
    const line = expandedLine(state);
    if (!line || !isTextileLine(line)) return false;

    // Refuse if the destination color already has items in another row —
    // merging silently would alter quantities the user didn't see.
    const destInUse = Object.values(line.items).some(
      (it) => !it.isPlaceholder && it.color === newColorId,
    );
    if (destInUse) return false;

    set((s) =>
      patchExpanded(s, (l) => {
        if (!isTextileLine(l)) return null;

        const items: Record<string, TextileItem> = {};
        for (const item of Object.values(l.items)) {
          if (item.color !== oldColorId || item.isPlaceholder) {
            items[item.id] = item;
            continue;
          }
          const newKey = `${newColorId}__${item.size}`;
          items[newKey] = { ...item, id: newKey, color: newColorId };
        }

        let batDrafts = l.batDrafts;
        if (batDrafts && batDrafts[oldColorId]) {
          const next = { ...batDrafts };
          next[newColorId] = (next[oldColorId] ?? []).map((d) => ({
            ...d,
            colorId: newColorId,
          }));
          delete next[oldColorId];
          batDrafts = next;
        }

        let linkedBats = l.linkedBats;
        if (linkedBats && linkedBats[oldColorId]) {
          const next = { ...linkedBats };
          next[newColorId] = next[oldColorId];
          delete next[oldColorId];
          linkedBats = next;
        }

        return { ...l, items, batDrafts, linkedBats };
      }),
    );
    return true;
  },

  setLogoPlacement: (id) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        let bodyPlacements: BodyPlacement[];
        let sleeveLogoPlacements: SleevePlacement[];
        if (id === "sleeve-left") {
          bodyPlacements = [];
          sleeveLogoPlacements = ["sleeve-left"];
        } else if (id === "sleeve-right") {
          bodyPlacements = [];
          sleeveLogoPlacements = ["sleeve-right"];
        } else if (id === "back-center" || id === "back-upper") {
          bodyPlacements = ["back"];
          sleeveLogoPlacements = [];
        } else {
          bodyPlacements = ["front"];
          sleeveLogoPlacements = [];
        }
        return { ...line, logoPlacement: id, bodyPlacements, sleeveLogoPlacements };
      }),
    ),

  toggleBodyPlacement: (placement) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const current = line.bodyPlacements ?? [];
        const next = current.includes(placement)
          ? current.filter((p) => p !== placement)
          : [...current, placement];
        return { ...line, bodyPlacements: next };
      }),
    ),

  setBodyPlacements: (placements) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isTextileLine(line) ? { ...line, bodyPlacements: placements } : null,
      ),
    ),

  toggleSleevePlacement: (placement) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const current = line.sleeveLogoPlacements ?? [];
        const next = current.includes(placement)
          ? current.filter((p) => p !== placement)
          : [...current, placement];
        return { ...line, sleeveLogoPlacements: next };
      }),
    ),

  setSleeveLogoPlacements: (sleeves) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isTextileLine(line) ? { ...line, sleeveLogoPlacements: sleeves } : null,
      ),
    ),

  setIdenticalLogoSetup: (value) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isTextileLine(line)
          ? { ...line, hasIdenticalLogoSetup: value }
          : null,
      ),
    ),

  setTextilePrixUnitaireOverride: (value) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        if (value === null) {
          const { prixUnitaireOverride: _omit, ...rest } = line;
          return rest;
        }
        return { ...line, prixUnitaireOverride: value };
      }),
    ),

  setBatDraft: (draft) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isTextileLine(line) ? { ...line, batDraft: draft } : null,
      ),
    ),

  addBatVersionForColor: (colorId, draft) => {
    const state = get();
    const line = expandedLine(state);
    if (!line || !isTextileLine(line)) {
      return { ...draft, version: 1, colorId } as BatDraft;
    }
    const existing = line.batDrafts?.[colorId] ?? [];
    const nextVersion = existing.length + 1;
    const next: BatDraft = { ...draft, version: nextVersion, colorId };
    set((s) =>
      patchExpanded(s, (l) => {
        if (!isTextileLine(l)) return null;
        const map = { ...(l.batDrafts ?? {}) };
        map[colorId] = [...(map[colorId] ?? []), next];
        return { ...l, batDrafts: map, batDraft: next };
      }),
    );
    return next;
  },

  clearBatVersionsForColor: (colorId) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line) || !line.batDrafts) return null;
        const map = { ...line.batDrafts };
        delete map[colorId];
        const remaining = Object.values(map).flat();
        const latest = remaining[remaining.length - 1] ?? null;
        return { ...line, batDrafts: map, batDraft: latest };
      }),
    ),

  setBatMode: (mode) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        if (mode === "reuse") {
          return { ...line, batMode: mode, batDrafts: {}, batDraft: null };
        }
        return { ...line, batMode: mode, linkedBats: {} };
      }),
    ),

  linkBatForColor: (colorId, ref) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line)) return null;
        const map = { ...(line.linkedBats ?? {}) };
        map[colorId] = ref;
        return { ...line, linkedBats: map, batMode: "reuse" };
      }),
    ),

  unlinkBatForColor: (colorId) =>
    set((s) =>
      patchExpanded(s, (line) => {
        if (!isTextileLine(line) || !line.linkedBats) return null;
        const map = { ...line.linkedBats };
        delete map[colorId];
        return { ...line, linkedBats: map };
      }),
    ),

  setDeferBat: (defer) =>
    set((s) =>
      patchExpanded(s, (line) =>
        isTextileLine(line) ? { ...line, deferBat: defer } : null,
      ),
    ),

  setLineDeferBat: (lineId, defer) =>
    set((s) => {
      const lines = s.draft.lines.map((r) => {
        if (r.id !== lineId) return r;
        if (!isTextileLine(r.line)) return r;
        const next: TextileLine = {
          ...r.line,
          deferBat: defer,
          personalizationMode: defer ? "without" : "with",
        };
        return { ...r, line: next };
      });
      return { ...s, draft: { ...s.draft, lines } };
    }),

  setLinePersonalizationMode: (lineId, mode) =>
    set((s) => {
      const lines = s.draft.lines.map((r) => {
        if (r.id !== lineId) return r;
        if (!isTextileLine(r.line)) return r;
        const next: TextileLine = {
          ...r.line,
          personalizationMode: mode,
          deferBat: mode === "without",
        };
        return { ...r, line: next };
      });
      return { ...s, draft: { ...s.draft, lines } };
    }),

  setAllPersonalizationMode: (mode) =>
    set((s) => {
      const lines = s.draft.lines.map((r) => {
        if (!isTextileLine(r.line)) return r;
        const next: TextileLine = {
          ...r.line,
          personalizationMode: mode,
          deferBat: mode === "without",
        };
        return { ...r, line: next };
      });
      return { ...s, draft: { ...s.draft, lines } };
    }),

  resetLineBat: (lineId) =>
    set((s) => {
      const lines = s.draft.lines.map((r) => {
        if (r.id !== lineId) return r;
        if (!isTextileLine(r.line)) return r;
        const next: TextileLine = { ...r.line };
        delete next.batDrafts;
        delete next.linkedBats;
        next.deferBat = false;
        next.personalizationMode = "with";
        return { ...r, line: next };
      });
      return { ...s, draft: { ...s.draft, lines } };
    }),

  loadFromOrder: (records, targetStep) =>
    set((s) => ({
      draft: {
        ...s.draft,
        lines: records,
        expandedLineId: null,
      },
      currentStep: targetStep ?? s.currentStep,
    })),

  clearLine: () =>
    set((s) => {
      const id = s.draft.expandedLineId;
      if (!id) return s;
      // Remove the expanded line entirely so the user goes back to the
      // category picker. Other lines are preserved.
      const lines = s.draft.lines.filter((r) => r.id !== id);
      return { draft: { ...s.draft, lines, expandedLineId: null } };
    }),

  resetLine: () =>
    set((s) => ({
      draft: { ...s.draft, lines: [], expandedLineId: null },
      // Le client est conservé (cas « Ajouter un autre article »), on saute
      // donc directement à l'étape Articles plutôt que de re-saisir Client.
      currentStep: 2,
    })),

  reset: () => {
    clearPersisted();
    set({
      draft: { header: EMPTY_HEADER, lines: [], expandedLineId: null },
      currentStep: 1,
      draftId: null,
    });
  },

  validate: () => {
    const { header, lines } = get().draft;
    const fieldErrors: ValidationResult["fieldErrors"] = {};
    if (!header.clientNom.trim()) {
      fieldErrors.clientNom = "Client requis";
    } else if (!header.clientId) {
      fieldErrors.clientNom = "Sélectionne un client existant ou crée la fiche";
    }
    if (lines.length === 0) {
      fieldErrors.secteur = "Au moins une référence requise";
    } else {
      const firstError = lines
        .map((r) => validateOneLine(r.line))
        .find((err): err is string => !!err);
      if (firstError) fieldErrors.line = firstError;
    }
    return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
  },
}));

// ───────── Persistence subscription ─────────
//
// Debounced (300 ms) + idle-callback so a burst of keystrokes coalesces into a
// single localStorage write instead of one JSON.stringify per character. The
// stripped blobs (cf. stripBlobsForPersistence) keep the payload small enough
// that the write itself is cheap.
if (typeof window !== "undefined") {
  let timer: number | null = null;
  const flush = () => {
    timer = null;
    const s = useNewOrderStore.getState();
    savePersisted({
      draft: s.draft,
      currentStep: s.currentStep,
      draftId: s.draftId,
    });
  };
  const ric: typeof window.requestIdleCallback | undefined =
    (window as Window & { requestIdleCallback?: typeof window.requestIdleCallback })
      .requestIdleCallback;
  useNewOrderStore.subscribe(() => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (ric) ric(flush, { timeout: 1000 });
      else flush();
    }, 300);
  });
}

// ───────── Scoped selectors ─────────

export const selectHeader = (s: NewOrderState) => s.draft.header;
/** The line currently expanded in the accordion. Null if none is expanded
 *  (the user may have collapsed all to focus on the totals). */
export const selectLine = (s: NewOrderState): OrderLine | null => {
  const r = findLine(s.draft.lines, s.draft.expandedLineId);
  return r ? r.line : null;
};
export const selectExpandedLineId = (s: NewOrderState) => s.draft.expandedLineId;
export const selectLines = (s: NewOrderState) => s.draft.lines;
export const selectSecteur = (s: NewOrderState): Secteur | null => {
  const line = selectLine(s);
  return currentSecteurOf(line);
};
export const selectStep = (s: NewOrderState) => s.currentStep;
export const selectDraftId = (s: NewOrderState) => s.draftId;

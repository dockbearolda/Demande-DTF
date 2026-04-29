import type { AssignedTo, OrderStatus, Secteur } from "@/lib/types";

export type Density = "compact" | "comfort";

export type BatState = "todo" | "wip" | "validated";

export const BAT_STATE_LABELS: Record<BatState, string> = {
  todo: "À créer",
  wip: "En cours",
  validated: "Validé",
};

export type ColumnId =
  | "reference"
  | "client"
  | "statut"
  | "secteur"
  | "livraison"
  | "assigne"
  | "montant"
  // Optionnelles
  | "date_creation"
  | "articles_total"
  | "nb_references"
  | "note"
  | "etape_suivante"
  | "derniere_activite"
  | "tag_urgence"
  | "etat_bat";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  width: number | "flex"; // px or "flex"
  align?: "left" | "right" | "center";
  optional?: boolean;
  defaultVisible?: boolean;
}

/** Order in which columns render when present. */
export const COLUMN_DEFS: ColumnDef[] = [
  { id: "reference", label: "Référence", width: 120, defaultVisible: true },
  { id: "client", label: "Client", width: "flex", defaultVisible: true },
  { id: "statut", label: "Statut", width: 140, defaultVisible: true },
  { id: "secteur", label: "Secteur", width: 100, defaultVisible: true },
  { id: "livraison", label: "Livraison", width: 100, defaultVisible: true },
  { id: "assigne", label: "Assigné", width: 70, align: "center", defaultVisible: true },
  { id: "montant", label: "Montant", width: 100, align: "right", defaultVisible: true },
  // Optionnelles
  { id: "date_creation", label: "Créée", width: 90, optional: true },
  { id: "articles_total", label: "Articles", width: 80, align: "right", optional: true },
  { id: "nb_references", label: "Réfs", width: 60, align: "right", optional: true },
  { id: "note", label: "Note", width: 56, align: "center", optional: true },
  { id: "etape_suivante", label: "Étape suivante", width: 160, optional: true },
  { id: "derniere_activite", label: "Activité", width: 110, optional: true },
  { id: "tag_urgence", label: "Urgent", width: 70, align: "center", optional: true },
  { id: "etat_bat", label: "État BAT", width: 100, optional: true },
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = COLUMN_DEFS.filter(
  (c) => c.defaultVisible,
).map((c) => c.id);

// ───────── Filtres ─────────

export type DatePresetId =
  | "this_week"
  | "this_month"
  | "overdue"
  | "due_7d"
  | "custom";

export interface DateRange {
  preset: DatePresetId | null;
  from: string | null; // YYYY-MM-DD
  to: string | null;
}

export interface ListFilters {
  /** Multi-select. Empty = "tous (sauf Archivé/CANCELLED)". */
  statuts: OrderStatus[];
  /** Empty = tous secteurs. */
  secteurs: Secteur[];
  /**
   * Liste d'opérateurs assignés. La valeur spéciale `"unassigned"` matche les
   * commandes sans `assigned_to`.
   */
  assignes: Array<AssignedTo | "unassigned">;
  client_id: string | null;
  date: DateRange;
  urgent: boolean;
  /** Recherche libre — référence / notes globales / contact. */
  q: string;
  // More filters
  bat_state: BatState | null;
  amount_min: number | null;
  amount_max: number | null;
  items_min: number | null;
  items_max: number | null;
}

export const EMPTY_FILTERS: ListFilters = {
  statuts: [],
  secteurs: [],
  assignes: [],
  client_id: null,
  date: { preset: null, from: null, to: null },
  urgent: false,
  q: "",
  bat_state: null,
  amount_min: null,
  amount_max: null,
  items_min: null,
  items_max: null,
};

// ───────── Tri ─────────

export type SortKey =
  | "statut"
  | "reference"
  | "client"
  | "livraison"
  | "date_creation"
  | "montant"
  | "secteur";

export interface SortRule {
  key: SortKey;
  dir: "asc" | "desc";
}

export const DEFAULT_SORT: SortRule[] = [
  { key: "statut", dir: "asc" },
  { key: "livraison", dir: "asc" },
];

// ───────── Vues sauvegardées ─────────

export interface SavedView {
  id: string;
  name: string;
  filters: ListFilters;
  sort: SortRule[];
  columns: ColumnId[];
  createdAt: number;
}

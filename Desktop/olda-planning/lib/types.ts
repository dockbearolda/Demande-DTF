export type ClientType = 'PRO' | 'PERSO' | '';

export type Family = 'DTF' | 'PRESSAGE' | 'UV' | 'TROTEC' | 'GOODIES' | 'AUTRES' | 'TEXTILES';

export type Stage =
  | 'demande'
  | 'devis'
  | 'accepted'
  | 'production'
  | 'facturation'
  | 'archived';

// ── Strict status union ────────────────────────────────────────────────────
export type ItemStatus =
  | 'A_DEVISER'
  | 'A_PRODUIRE'
  | 'A_PREPARER'
  | 'A_FACTURER'
  | 'A_MONTER_NETTOYER'
  | 'MAQUETTE_A_FAIRE'
  | 'ATTENTE_VALIDATION'
  | 'ATTENTE_MARCHANDISE'
  | 'MANQUE_INFORMATION'
  | 'EN_PRODUCTION'
  | 'CLIENT_PREVENU'
  | 'PREVENIR_CLIENT'
  | 'PRODUIT_RECUPERE'
  | 'TERMINE'
  | 'on_hold'
  | 'archived_unresponsive'
  | '';   // empty default before first save

export interface OrderLine {
  id:       string;
  family:   Family;   // single sector per line
  product:  string;
  quantity: string;
  onHold?:  boolean;  // UI-only flag — line is parked, not submitted
}

export interface PlanningItem {
  id:          string;
  clientType:  ClientType;
  clientId:    number | null;
  clientPhone?:       string;  // optional — no longer required
  clientContactName?: string;  // Personne à joindre (optionnel)
  clientName:         string;

  /** Primary sector(s) — at least one entry. Replaces the old single `family: Family`. */
  sectors:     Family[];

  /** Legacy flat fields — kept for single-line cards & display convenience */
  product:  string;   // lines[0].product (or joined if multi-line)
  quantity: string;   // lines[0].quantity

  lines?:   OrderLine[];  // undefined = legacy mode

  note:              string;
  deliveryDate:      string;        // ISO Date string
  planningDate:      string | null; // ISO Date string (YYYY-MM-DD)
  needsMockup:       boolean;
  mockupStatus:      string;
  mockupCompletedAt: string | null;

  status:   ItemStatus;
  stage:    Stage;

  /** Operator who is responsible for this order */
  assignedTo: OperatorKey | '';

  /** Operator who created this order (set from active session profile) */
  createdBy: OperatorKey | '';

  /** Flags this order as urgent — surfaces it visually */
  isUrgent: boolean;

  createdAt:  string;
  updatedAt:  string;
  archivedAt: string | null;
  position?:  number;
}

export const STAGES: { [key in Stage]: { label: string; color: string } } = {
  demande:     { label: 'Demande',       color: 'var(--status-demande)'   },
  devis:       { label: 'Devis en cours', color: 'var(--status-devis)'     },
  accepted:    { label: 'Devis accepté', color: 'var(--status-accepted)'  },
  production:  { label: 'Production',    color: 'var(--status-production)' },
  facturation: { label: 'Facturation',   color: 'var(--status-facture)'   },
  archived:    { label: 'Archivé',       color: 'var(--status-archived)'  },
};

export const FAMILIES: Family[] = ['DTF', 'PRESSAGE', 'UV', 'TROTEC', 'GOODIES', 'AUTRES', 'TEXTILES'];

// ── Operators — shared config for avatars, filters and assignment ───────────
export const OPERATORS = [
  { key: 'loic',    initial: 'L', label: 'Loïc',   bg: '#1e293b', color: '#f8fafc' },
  { key: 'charlie', initial: 'C', label: 'Charlie', bg: '#64748b', color: '#ffffff' },
  { key: 'melina',  initial: 'M', label: 'Mélina',  bg: '#cbd5e1', color: '#1e293b' },
] as const;

export type OperatorKey = typeof OPERATORS[number]['key'];

// ── Convenience helper — get primary sector from an item ───────────────────
export const primarySector = (item: PlanningItem): Family =>
  item.sectors?.[0] ?? 'AUTRES';

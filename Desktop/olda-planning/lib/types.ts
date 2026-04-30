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
  note?:    string;   // per-line special instructions
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
  demande:     { label: 'Demande',        color: 'var(--status-demande)'    },
  devis:       { label: 'Devis en cours', color: 'var(--status-devis)'      },
  accepted:    { label: 'Devis accepté',  color: 'var(--status-accepted)'   },
  production:  { label: 'Production',     color: 'var(--status-production)' },
  facturation: { label: 'Facturation',    color: 'var(--status-facture)'    },
  archived:    { label: 'Archivé',        color: 'var(--status-archived)'   },
};

export const FAMILIES: Family[] = ['DTF', 'PRESSAGE', 'UV', 'TROTEC', 'GOODIES', 'AUTRES', 'TEXTILES'];

// ── Operators — shared config for avatars, filters and assignment ───────────
// Monochrome quiet-luxury scheme: slate-800 / slate-500 / slate-300
export const OPERATORS = [
  { key: 'loic',    initial: 'L', label: 'Loïc',    bg: '#2F3B45', color: '#f5f7f8' }, // ink-2
  { key: 'charlie', initial: 'C', label: 'Charlie', bg: '#6B8191', color: '#f5f7f8' }, // accent
  { key: 'melina',  initial: 'M', label: 'Mélina',  bg: '#CDD4CD', color: '#202930' }, // sage
] as const;

export type OperatorKey = typeof OPERATORS[number]['key'];

// ── Convenience helper — get primary sector from an item ───────────────────
export const primarySector = (item: PlanningItem): Family =>
  item.sectors?.[0] ?? 'AUTRES';

// ── Client Journal — internal team notes with alert tagging ───────────────
export type NoteAlertTag = 'malhonnete' | 'complexe' | 'vip';

export interface ClientNote {
  id: string;
  /** clientName.trim().toLowerCase() — matches analytics key */
  clientKey: string;
  content: string;
  alertTag: NoteAlertTag | null;
  authorKey: OperatorKey | '';
  createdAt: string; // ISO
}

// ── CRM Extension ──────────────────────────────────────────────────────────

export type CRMStatus = 'prospect' | 'actif' | 'vip' | 'inactif' | 'bloque';
export type ContactPreference = 'telephone' | 'email' | 'sms' | 'presentiel';
export type InteractionType = 'note' | 'appel' | 'email' | 'reunion' | 'devis' | 'fichier' | 'alerte';
export type FileCategory = 'facture' | 'bon_commande' | 'contrat' | 'maquette' | 'image' | 'autre';

export interface ClientProfile {
  clientKey: string;
  address?: string;
  website?: string;
  siret?: string;
  /** Préférences comportementales — ce que le client aime */
  likes: string;
  /** Préférences comportementales — ce que le client n'aime pas */
  dislikes: string;
  /** Notes de profil libres */
  profileNotes: string;
  customTags: string[];
  crmStatus: CRMStatus;
  preferredContact: ContactPreference;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInteraction {
  id: string;
  clientKey: string;
  type: InteractionType;
  title: string;
  content: string;
  authorKey: OperatorKey | '';
  relatedOrderId?: string;
  relatedFileId?: string;
  createdAt: string;
}

export interface ClientFile {
  id: string;
  clientKey: string;
  name: string;
  originalName: string;
  category: FileCategory;
  mimeType: string;
  size: number;
  /** Path relative to the workspace planning-olda directory */
  relativePath: string;
  uploadedBy: OperatorKey | '';
  uploadedAt: string;
  description?: string;
}

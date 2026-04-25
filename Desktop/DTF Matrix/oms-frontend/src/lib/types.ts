export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "BAT_SENT"
  | "BAT_APPROVED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export const ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "IN_PRODUCTION",
  "BAT_SENT",
  "BAT_APPROVED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  IN_PRODUCTION: "En production",
  BAT_SENT: "BAT envoyé",
  BAT_APPROVED: "BAT validé",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "BAT_SENT",
  "BAT_APPROVED",
];

/**
 * Maps order statuses to OLDA DS tokens (background, foreground, dot accent).
 * Values are raw CSS vars meant to be consumed via `style={{}}` — not
 * Tailwind classes.
 */
export const STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; fg: string; dot: string }
> = {
  DRAFT: {
    bg: "var(--status-demande)",
    fg: "var(--fg-3)",
    dot: "var(--fg-4)",
  },
  CONFIRMED: {
    bg: "var(--status-devis)",
    fg: "var(--fg-2)",
    dot: "var(--brand-duck-300)",
  },
  IN_PRODUCTION: {
    bg: "var(--status-production)",
    fg: "var(--fg-1)",
    dot: "var(--color-urgent)",
  },
  BAT_SENT: {
    bg: "var(--status-facture)",
    fg: "var(--fg-2)",
    dot: "var(--brand-duck-400)",
  },
  BAT_APPROVED: {
    bg: "var(--status-accepted)",
    fg: "var(--fg-1)",
    dot: "var(--brand-duck-500)",
  },
  SHIPPED: {
    bg: "var(--status-paye)",
    fg: "var(--fg-on-primary)",
    dot: "var(--fg-on-primary)",
  },
  DELIVERED: {
    bg: "var(--brand-duck-500)",
    fg: "var(--fg-on-primary)",
    dot: "var(--fg-on-primary)",
  },
  CANCELLED: {
    bg: "var(--status-demande)",
    fg: "var(--fg-4)",
    dot: "var(--fg-4)",
  },
};

export interface Client {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderClientSummary {
  id: string;
  nom: string;
  email: string | null;
}

export interface Order {
  id: string;
  client_id: string;
  reference: string;
  statut: OrderStatus;
  montant_total: string; // decimal serialized as string
  date_commande: string;
  date_livraison_prevue: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: OrderClientSummary | null;
}

export type BatStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface BatSideComposition {
  mockup: string | null;
  logo: string | null;
  positionXPct: number;
  positionYPct: number;
  logoWidthPct: number;
}

export interface BatComposition {
  front: BatSideComposition;
  back: BatSideComposition;
}

export interface BAT {
  id: string;
  order_id: string;
  token: string;
  file_name: string;
  file_type: string;
  message: string | null;
  status: BatStatus;
  decision_comment: string | null;
  decided_at: string | null;
  created_at: string;
  expires_at: string;
  composition_metadata: BatComposition | null;
}

export interface KanbanColumn {
  status: OrderStatus;
  label: string;
  count: number;
  orders: Order[];
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

export interface KanbanMetrics {
  total: number;
  active: number;
  overdue: number;
  total_amount: number;
  by_status: Record<OrderStatus, number>;
}

export interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface OrderFilters {
  statut?: OrderStatus;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export function isOverdue(order: Order): boolean {
  if (!order.date_livraison_prevue) return false;
  if (!ACTIVE_STATUSES.includes(order.statut)) return false;
  const due = new Date(order.date_livraison_prevue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

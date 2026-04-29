import type { OrderStatus, Secteur } from "@/lib/types";

/**
 * Ordre métier des statuts pour le tri par défaut :
 * Demande > Devis cours > Devis accepté > Production > Facturation.
 *
 * Les codes du modèle ne mappent pas 1:1, mais on les place dans l'ordre
 * du flux atelier — l'opérateur voit donc d'abord ce qui est urgent à
 * traiter, puis ce qui descend dans le pipeline.
 */
export const STATUS_BUSINESS_ORDER: OrderStatus[] = [
  "DRAFT",          // Demande / Brouillon
  "EN_ATTENTE_BAT", // Devis cours — BAT à faire
  "BAT_SENT",       // Devis cours — BAT envoyé
  "BAT_APPROVED",   // Devis accepté — BAT validé
  "CONFIRMED",      // Devis accepté — confirmée
  "IN_PRODUCTION",  // Production
  "SHIPPED",        // Facturation
  "DELIVERED",      // Livrée
  "CANCELLED",      // Archivée
];

/** Index pour comparer rapidement deux statuts dans le tri. */
export const STATUS_RANK: Record<OrderStatus, number> = STATUS_BUSINESS_ORDER.reduce(
  (acc, s, idx) => {
    acc[s] = idx;
    return acc;
  },
  {} as Record<OrderStatus, number>,
);

/**
 * Statuts que l'opérateur ne veut PAS voir par défaut.
 * Les filtres excluent ces statuts tant que l'opérateur ne les coche pas
 * explicitement dans le multi-select Statut.
 */
export const ARCHIVED_STATUSES: OrderStatus[] = ["CANCELLED"];

export const SECTEUR_LIST: Secteur[] = [
  "DTF",
  "PRESSAGE",
  "UV",
  "TROTEC",
  "GOODIES",
  "AUTRES",
];

/** Étape suivante humaine pour chaque statut, surfacée en mode Confort. */
export const NEXT_STEP_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Confirmer la demande",
  EN_ATTENTE_SOURCING: "Sourcer les articles hors catalogue",
  EN_ATTENTE_BAT: "Envoyer le BAT",
  CONFIRMED: "Lancer la production",
  IN_PRODUCTION: "Production en cours",
  BAT_SENT: "Attente validation BAT",
  BAT_APPROVED: "Lancer la production",
  SHIPPED: "Facturer",
  DELIVERED: "Clôturée",
  CANCELLED: "Archivée",
};

export const STORAGE_KEYS = {
  density: "orders-list:density",
  columns: "orders-list:columns",
  sort: "orders-list:sort",
  expanded: "orders-list:expanded",
  filters: "orders-list:filters",
  views: "orders-list:views",
} as const;

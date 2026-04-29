import type { OrderStatus } from "@/lib/types";

/**
 * Flux métier linéaire pour les transitions au clavier / clic-flèche.
 *
 * Demande → Devis en cours → Devis accepté → Production → Facturation → Archivé.
 *
 * Volontairement plus court que `STATUS_BUSINESS_ORDER` : on ne veut pas que
 * `→` fasse passer DRAFT par 5 sous-états, on saute directement à l'étape
 * "humaine" suivante.
 */
export const STATUS_FLOW: OrderStatus[] = [
  "DRAFT",
  "EN_ATTENTE_BAT",
  "BAT_APPROVED",
  "IN_PRODUCTION",
  "SHIPPED",
  "CANCELLED",
];

/** Libellé court de la phase métier d'un statut. */
export const FLOW_PHASE_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Demande",
  EN_ATTENTE_SOURCING: "Sourcing",
  EN_ATTENTE_BAT: "Devis en cours",
  BAT_SENT: "Devis en cours",
  CONFIRMED: "Devis accepté",
  BAT_APPROVED: "Devis accepté",
  IN_PRODUCTION: "Production",
  SHIPPED: "Facturation",
  DELIVERED: "Facturation",
  CANCELLED: "Archivé",
};

function projectToFlowIndex(s: OrderStatus): number {
  // Aligne les statuts hors-flow sur le nœud le plus proche du flux principal.
  switch (s) {
    case "EN_ATTENTE_SOURCING":
      // Sourcing s'intercale juste après "Demande" : `→` au clavier doit
      // emmener vers "Devis en cours" (= EN_ATTENTE_BAT) une fois le
      // fournisseur trouvé et le prix renseigné.
      return STATUS_FLOW.indexOf("DRAFT");
    case "BAT_SENT":
      return STATUS_FLOW.indexOf("EN_ATTENTE_BAT");
    case "CONFIRMED":
      return STATUS_FLOW.indexOf("BAT_APPROVED");
    case "DELIVERED":
      return STATUS_FLOW.indexOf("SHIPPED");
    default:
      return STATUS_FLOW.indexOf(s);
  }
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  const idx = projectToFlowIndex(s);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

export function prevStatus(s: OrderStatus): OrderStatus | null {
  const idx = projectToFlowIndex(s);
  if (idx <= 0) return null;
  return STATUS_FLOW[idx - 1];
}

/** Liste complète des phases (pour affichage timeline / filtres rapides 1-5). */
export const QUICK_FILTER_STATUSES: Array<{
  digit: "1" | "2" | "3" | "4" | "5";
  label: string;
  statuses: OrderStatus[];
}> = [
  { digit: "1", label: "Demande", statuses: ["DRAFT"] },
  { digit: "2", label: "Devis cours", statuses: ["EN_ATTENTE_BAT", "BAT_SENT"] },
  { digit: "3", label: "Devis accepté", statuses: ["BAT_APPROVED", "CONFIRMED"] },
  { digit: "4", label: "Production", statuses: ["IN_PRODUCTION"] },
  { digit: "5", label: "Facturation", statuses: ["SHIPPED", "DELIVERED"] },
];

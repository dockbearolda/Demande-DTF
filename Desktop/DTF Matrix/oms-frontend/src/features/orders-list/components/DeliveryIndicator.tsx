import { daysUntilDelivery } from "../state/filterOrders";
import type { Order } from "@/lib/types";

interface Props {
  order: Order;
}

const FORMAT_SHORT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

/**
 * Date courte fr + ● vert/ambre/rouge selon proximité de la livraison.
 *
 * - rouge `--color-danger`   : en retard (j < 0)  — usage destructif autorisé.
 * - ambre `--color-urgent`   : urgent (0 ≤ j ≤ 3) — token DS.
 * - sage  `--brand-duck-300` : plus loin (j ≥ 4) — slate-blue muted.
 */
export function DeliveryIndicator({ order }: Props) {
  const due = order.date_livraison_prevue;
  if (!due) {
    return (
      <span style={{ color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>—</span>
    );
  }

  const days = daysUntilDelivery(order);
  const overdue = days != null && days < 0;
  const isActive =
    order.statut !== "DELIVERED" &&
    order.statut !== "CANCELLED" &&
    order.statut !== "SHIPPED";

  let dotColor = "var(--brand-duck-300)";
  let textColor = "var(--fg-2)";
  let weight: 500 | 600 | 700 = 500;

  if (isActive && overdue) {
    dotColor = "var(--color-danger)";
    textColor = "var(--color-danger)";
    weight = 700;
  } else if (isActive && days != null && days <= 3) {
    dotColor = "var(--color-urgent)";
    textColor = "var(--color-urgent-ink)";
    weight = 600;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: weight,
        color: textColor,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {FORMAT_SHORT.format(new Date(due))}
    </span>
  );
}

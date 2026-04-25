import { useDraggable } from "@dnd-kit/core";
import { isOverdue, type Order } from "@/lib/types";

interface Props {
  order: Order;
}

function formatCurrency(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(value),
  );
}

export function KanbanCard({ order }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });
  const overdue = isOverdue(order);

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.4 : 1,
    background: "var(--brand-paper)",
    border: overdue
      ? "1px solid var(--color-urgent-border, var(--color-danger))"
      : "1px solid var(--brand-sage-100)",
    boxShadow: overdue
      ? "0 0 0 1px color-mix(in srgb, var(--color-danger) 20%, transparent)"
      : "var(--shadow-1)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab select-none rounded-lg p-3 transition-shadow hover:shadow-md active:cursor-grabbing"
      aria-label={`Commande ${order.reference}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="truncate text-sm font-semibold" style={{ color: "var(--fg-1)" }}>
          {order.reference}
        </div>
        {overdue ? (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{
              background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
              color: "var(--color-danger)",
            }}
            aria-label="En retard"
          >
            Retard
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--fg-3)" }}>
        <span className="tabular-nums">{formatDate(order.date_livraison_prevue)}</span>
        <span className="tabular-nums font-medium" style={{ color: "var(--fg-2)" }}>
          {formatCurrency(order.montant_total)}
        </span>
      </div>
    </div>
  );
}

import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import { STATUS_COLORS, type KanbanColumn as KanbanColumnType } from "@/lib/types";

interface Props {
  column: KanbanColumnType;
}

export function KanbanColumn({ column }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: { status: column.status },
  });
  const palette = STATUS_COLORS[column.status];

  return (
    <div
      ref={setNodeRef}
      className="flex w-72 shrink-0 flex-col rounded-xl p-3 transition-colors"
      style={{
        background: "var(--brand-paper-hi)",
        border: isOver
          ? "1px solid var(--brand-duck-500)"
          : "1px solid var(--brand-sage-100)",
        boxShadow: isOver ? "0 0 0 2px color-mix(in srgb, var(--brand-duck-500) 20%, transparent)" : undefined,
      }}
      aria-label={`Colonne ${column.label}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: palette.dot,
            }}
          />
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg-1)" }}>
            {column.label}
          </h2>
        </div>
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ background: "var(--brand-sage-100)", color: "var(--fg-2)" }}
        >
          {column.count}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ minHeight: 64 }}>
        {column.orders.length === 0 ? (
          <div
            className="rounded p-3 text-center text-xs"
            style={{
              border: "1px dashed var(--brand-sage-200, var(--brand-sage-100))",
              color: "var(--fg-4)",
            }}
          >
            Glissez une commande ici
          </div>
        ) : (
          column.orders.map((order) => <KanbanCard key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}

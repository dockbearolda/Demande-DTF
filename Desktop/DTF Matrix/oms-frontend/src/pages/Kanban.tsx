import { useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { useToast } from "@/components/Toast";
import { useKanbanBoard, useKanbanTransition } from "@/hooks/useKanban";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  type KanbanColumn as KanbanColumnType,
  type Order,
  type OrderStatus,
} from "@/lib/types";
import { AxiosError } from "axios";

function ensureAllColumns(columns: KanbanColumnType[]): KanbanColumnType[] {
  const byStatus = new Map(columns.map((c) => [c.status, c]));
  return ORDER_STATUSES.map((status) => {
    const existing = byStatus.get(status);
    if (existing) return existing;
    return {
      status,
      label: STATUS_LABELS[status],
      count: 0,
      orders: [] as Order[],
    };
  });
}

export function KanbanPage() {
  const { data, isLoading, error } = useKanbanBoard();
  const transition = useKanbanTransition();
  const { show } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(
    () => ensureAllColumns(data?.columns ?? []),
    [data],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const order = active.data.current?.order as Order | undefined;
    const toStatus = over.data.current?.status as OrderStatus | undefined;
    if (!order || !toStatus) return;
    if (order.statut === toStatus) return;

    transition.mutate(
      { order_id: order.id, to_status: toStatus },
      {
        onSuccess: () => {
          show(
            `${order.reference} → ${STATUS_LABELS[toStatus]}`,
            "success",
          );
        },
        onError: (err) => {
          const axiosErr = err as AxiosError<{ detail?: string }>;
          const status = axiosErr.response?.status;
          const detail =
            axiosErr.response?.data?.detail ?? "Transition refusée";
          if (status === 409) {
            show(`Transition impossible : ${detail}`, "error");
          } else {
            show(`Erreur : ${detail}`, "error");
          }
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>
          Kanban
        </h1>
        <p className="text-sm" style={{ color: "var(--fg-3)" }}>
          Glissez-déposez une commande pour changer son statut.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{
            border: "1px solid var(--color-danger)",
            background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          Impossible de charger le tableau.
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm" style={{ color: "var(--fg-3)" }}>Chargement…</div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div
            className="flex gap-4 overflow-x-auto pb-2"
            aria-label="Tableau Kanban"
          >
            {columns.map((col) => (
              <KanbanColumn key={col.status} column={col} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

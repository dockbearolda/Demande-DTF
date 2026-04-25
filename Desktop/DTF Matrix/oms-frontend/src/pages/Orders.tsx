import { useEffect, useMemo, useState } from "react";
import { OrderTable } from "@/components/OrderTable";
import { NewOrderModal } from "@/components/NewOrderModal";
import { useClients } from "@/hooks/useClients";
import { useOrders } from "@/hooks/useOrders";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  type OrderFilters,
  type OrderStatus,
} from "@/lib/types";

const PAGE_SIZE = 50;

const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper)",
  color: "var(--fg-1)",
};

const BTN_SECONDARY: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper-hi)",
  color: "var(--fg-2)",
};

export function OrdersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [statut, setStatut] = useState<OrderStatus | "">("");
  const [clientId, setClientId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState<number>(0);

  const filters: OrderFilters = useMemo(
    () => ({
      statut: statut || undefined,
      client_id: clientId || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [statut, clientId, dateFrom, dateTo, page],
  );

  const { data: orders = [], isLoading } = useOrders(filters);
  const { data: clients = [] } = useClients();

  const hasNext = orders.length === PAGE_SIZE;

  function resetFilters() {
    setStatut("");
    setClientId("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === "n" || e.key === "N")) {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        const editing =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (document.activeElement as HTMLElement | null)?.isContentEditable;
        if (editing) return;
        e.preventDefault();
        setModalOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>
            Commandes
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-3)" }}>
            {orders.length} résultat{orders.length > 1 ? "s" : ""} (page {page + 1})
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-[8px] px-3 text-[12.5px] font-semibold"
          style={{ background: "var(--brand-duck-500)", color: "var(--brand-paper)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--fg-1)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-duck-500)")}
        >
          <span>+ Nouvelle commande</span>
          <span className="ml-1 inline-flex items-center gap-0.5 opacity-80">
            <kbd className="olda-kbd">⌘</kbd>
            <kbd className="olda-kbd">N</kbd>
          </span>
        </button>
      </header>

      <NewOrderModal open={modalOpen} onOpenChange={setModalOpen} />

      <div
        className="grid grid-cols-1 gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-5"
        style={{
          background: "var(--brand-paper)",
          border: "1px solid var(--brand-sage-100)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <label className="text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Statut
          <select
            value={statut}
            onChange={(e) => {
              setStatut((e.target.value || "") as OrderStatus | "");
              setPage(0);
            }}
            className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
            style={INPUT_STYLE}
          >
            <option value="">Tous</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Client
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(0);
            }}
            className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
            style={INPUT_STYLE}
          >
            <option value="">Tous</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Date de début
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(0);
            }}
            className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
            style={INPUT_STYLE}
          />
        </label>

        <label className="text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Date de fin
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(0);
            }}
            className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
            style={INPUT_STYLE}
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetFilters}
            className="h-[34px] w-full rounded-md px-3 text-sm font-medium"
            style={BTN_SECONDARY}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <OrderTable orders={orders} loading={isLoading} />

      <div
        className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 px-4 py-2 backdrop-blur"
        style={{
          borderTop: "1px solid var(--brand-sage-100)",
          background: "color-mix(in srgb, var(--brand-paper) 90%, transparent)",
        }}
      >
        <span className="mr-auto text-xs" style={{ color: "var(--fg-3)" }}>Page {page + 1}</span>
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          style={BTN_SECONDARY}
        >
          Précédent
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          style={BTN_SECONDARY}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

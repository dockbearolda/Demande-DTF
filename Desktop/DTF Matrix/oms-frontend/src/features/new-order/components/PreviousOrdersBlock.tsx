import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useOrders } from "@/hooks/useOrders";
import { useToast } from "@/components/Toast";
import type { Order } from "@/lib/types";
import { useNewOrderStore } from "../store";
import { buildRecordsFromOrder, summarizeOrderLines } from "../loadFromOrder";

interface Props {
  clientId: string;
}

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatOrderDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d).replace(".", "");
}

function formatTotalTTC(montantHt: string): string {
  const ht = Number.parseFloat(montantHt);
  if (Number.isNaN(ht)) return "—";
  return `${EUR.format(ht)} HT`;
}

/**
 * Affiche les 3 dernières commandes du client pour un démarrage en un clic.
 *
 * Visible uniquement après sélection d'un client. Les cartes pré-remplissent
 * références, tailles et quantités dans le brouillon courant — l'utilisateur
 * peut ensuite ajuster avant de valider.
 */
export function PreviousOrdersBlock({ clientId }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const loadFromOrder = useNewOrderStore((s) => s.loadFromOrder);

  const { data: orders = [], isLoading } = useOrders({
    client_id: clientId,
    limit: 10,
  });

  // The list endpoint already orders by `date_commande desc` server-side, but
  // re-sort defensively so the slice we render is always the freshest 3.
  const recent = useMemo(() => {
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.date_commande).getTime() -
          new Date(a.date_commande).getTime(),
      )
      .slice(0, 3);
  }, [orders]);

  if (isLoading || recent.length === 0) return null;

  const handleResume = (order: Order) => {
    const records = buildRecordsFromOrder(order);
    if (records.length === 0) {
      toast.show(
        "Cette commande ne contient pas de lignes reprises automatiquement.",
        "error",
      );
      return;
    }
    // Skip directly to step 4 (Livraison) — refs (step 2) and BAT (step 3)
    // are now pre-filled, the user only needs to confirm delivery details.
    loadFromOrder(records, 4);
    toast.show(
      `Commande ${order.reference} reprise. Tu peux modifier avant de valider.`,
      "success",
    );
  };

  return (
    <section
      aria-label="Reprendre une commande précédente"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Reprendre une commande
        </h3>
        <button
          type="button"
          onClick={() => navigate(`/orders?client_id=${clientId}`)}
          className="text-[11px] font-semibold text-[#4A6274] transition-colors hover:text-[#3a4e5d]"
        >
          Voir tout l'historique →
        </button>
      </div>

      <div
        role="list"
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pl-1 pr-1 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {recent.map((order) => (
          <ResumeCard
            key={order.id}
            order={order}
            onResume={() => handleResume(order)}
          />
        ))}
      </div>
    </section>
  );
}

function ResumeCard({
  order,
  onResume,
}: {
  order: Order;
  onResume: () => void;
}) {
  const { refsCount, totalQty } = summarizeOrderLines(order);
  const refsLabel = refsCount === 1 ? "1 réf" : `${refsCount} réfs`;
  const articlesLabel = totalQty === 1 ? "1 article" : `${totalQty} articles`;

  return (
    <article
      role="listitem"
      className="flex w-[240px] shrink-0 snap-start flex-col gap-3 rounded-xl border border-[rgba(74,98,116,0.08)] bg-white/60 p-4 backdrop-blur-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[rgba(74,98,116,0.18)] hover:bg-white/80 hover:shadow-[0_4px_14px_-6px_rgba(74,98,116,0.18)]"
    >
      <header className="space-y-0.5">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-700">
          CMD {order.reference}
        </div>
        <div className="text-[11px] text-slate-500">
          {formatOrderDate(order.date_commande)}
        </div>
      </header>

      <div className="space-y-1 text-[12px] text-slate-700">
        <div className="flex items-center gap-1.5">
          <RefDots count={refsCount} />
          <span className="font-medium">{refsLabel}</span>
        </div>
        <div className="text-[12px] text-slate-600">{articlesLabel}</div>
      </div>

      <div className="text-[13px] font-semibold tabular-nums text-slate-900">
        {formatTotalTTC(order.montant_total)}
      </div>

      <button
        type="button"
        onClick={onResume}
        className="mt-auto inline-flex h-9 items-center justify-center rounded-xl border border-[#4A6274] bg-white px-3 text-[12px] font-semibold text-[#4A6274] transition-colors hover:bg-[#4A6274]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6274] focus-visible:ring-offset-1"
      >
        Reprendre
      </button>
    </article>
  );
}

/** Up to 3 small squares illustrating the count of references in the order. */
function RefDots({ count }: { count: number }) {
  const visible = Math.min(count, 3);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          className="block h-2.5 w-2.5 rounded-[2px] border border-[rgba(74,98,116,0.3)] bg-[rgba(74,98,116,0.08)]"
        />
      ))}
    </span>
  );
}

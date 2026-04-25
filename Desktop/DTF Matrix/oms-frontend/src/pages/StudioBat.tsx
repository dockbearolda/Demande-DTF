import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOrders } from "@/hooks/useOrders";
import { StatusBadge } from "@/components/StatusBadge";
import type { OrderStatus } from "@/lib/types";

const AWAITING_BAT_STATUSES: OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "IN_PRODUCTION",
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

export function StudioBatPage() {
  const { data: orders = [], isLoading } = useOrders({ limit: 200 });
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => AWAITING_BAT_STATUSES.includes(o.statut))
      .filter((o) => !q || o.reference.toLowerCase().includes(q))
      .sort((a, b) => a.reference.localeCompare(b.reference));
  }, [orders, search]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>
          Studio BAT
        </h1>
        <p className="text-sm" style={{ color: "var(--fg-3)" }}>
          Choisissez une commande pour composer son BAT
        </p>
      </header>

      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--brand-paper)",
          border: "1px solid var(--brand-sage-100)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <input
          type="text"
          placeholder="Rechercher par référence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full rounded-md px-3 py-2 text-sm"
          style={{
            border: "1px solid var(--brand-sage-100)",
            background: "var(--brand-paper-hi)",
            color: "var(--fg-1)",
          }}
        />
      </div>

      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: "var(--brand-paper)",
          border: "1px solid var(--brand-sage-100)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <table className="min-w-full text-sm">
          <thead style={{ background: "var(--brand-paper-hi)" }}>
            <tr>
              {["Référence", "Statut", "Livraison"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--fg-3)" }}
                >
                  {h}
                </th>
              ))}
              <th
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--fg-3)" }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                  Chargement…
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                  Aucune commande en attente de BAT
                </td>
              </tr>
            ) : (
              candidates.map((order, i) => (
                <tr
                  key={order.id}
                  style={{
                    background: i % 2 === 0 ? "var(--brand-paper)" : "var(--brand-paper-hi)",
                  }}
                >
                  <td
                    className="px-3 py-2 font-medium"
                    style={{
                      borderTop: "1px solid var(--brand-sage-100)",
                      color: "var(--fg-1)",
                    }}
                  >
                    {order.reference}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{ borderTop: "1px solid var(--brand-sage-100)" }}
                  >
                    <StatusBadge status={order.statut} />
                  </td>
                  <td
                    className="px-3 py-2 tabular-nums"
                    style={{
                      borderTop: "1px solid var(--brand-sage-100)",
                      color: "var(--fg-2)",
                    }}
                  >
                    {formatDate(order.date_livraison_prevue)}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ borderTop: "1px solid var(--brand-sage-100)" }}
                  >
                    <Link
                      to={`/studio-bat/${order.id}`}
                      className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium"
                      style={{
                        background: "var(--brand-duck-500)",
                        color: "var(--fg-on-primary)",
                      }}
                    >
                      Composer BAT
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

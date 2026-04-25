import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { isOverdue, type Order } from "@/lib/types";

type SortKey = "reference" | "statut" | "date_commande" | "date_livraison_prevue" | "montant_total";
type SortDir = "asc" | "desc";
type Density = "compact" | "comfort";

const DENSITY_KEY = "ordertable:density";
const ROW_BORDER = "1px solid rgba(74,98,116,0.08)";
const TH_STYLE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "#F5F6F7",
  borderBottom: "1px solid rgba(74,98,116,0.12)",
  padding: "0 8px",
  height: 32,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  color: "var(--fg-3)",
  whiteSpace: "nowrap" as const,
};

interface Props {
  orders: Order[];
  loading?: boolean;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

function IconFilePlus() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M9 15h6M12 12v6" />
    </svg>
  );
}

function IconMoreHorizontal() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function IconTriangleAlert() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

const ASSIGNEES = ["loic", "charlie", "melina"] as const;
const ASSIGNEE_INITIALS: Record<string, string> = { loic: "L", charlie: "C", melina: "M" };

function AssigneePips({ assigned }: { assigned?: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {ASSIGNEES.map((a) => {
        const active = assigned === a;
        return (
          <span
            key={a}
            title={a.charAt(0).toUpperCase() + a.slice(1)}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              fontSize: 9,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: active ? "var(--fg-3)" : "rgba(107,129,145,0.10)",
              color: active ? "#fff" : "var(--fg-4)",
              letterSpacing: 0,
            }}
          >
            {ASSIGNEE_INITIALS[a]}
          </span>
        );
      })}
    </div>
  );
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  "aria-label": string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      style={{ cursor: "pointer", accentColor: "var(--brand-duck-500)" }}
    />
  );
}

function BulkActionBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  const btnStyle: React.CSSProperties = {
    padding: "5px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "default",
  };
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--fg-2)",
        color: "#fff",
        borderRadius: 10,
        padding: "8px 14px",
        boxShadow: "0 4px 24px rgba(32,41,48,0.28)",
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums", marginRight: 4 }}>
        {count} sélectionnée{count > 1 ? "s" : ""}
      </span>
      <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
      <button type="button" style={btnStyle}>Passer en production</button>
      <button type="button" style={btnStyle}>Assigner</button>
      <button type="button" style={btnStyle}>Exporter CSV</button>
      <button type="button" style={{ ...btnStyle, background: "rgba(220,38,38,0.3)", borderColor: "rgba(220,38,38,0.4)" }}>Supprimer</button>
      <button
        type="button"
        onClick={onClear}
        style={{ marginLeft: 4, padding: "5px 8px", borderRadius: 6, fontSize: 12, background: "transparent", color: "rgba(255,255,255,0.6)", border: "none" }}
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
}

export function OrderTable({ orders, loading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date_commande");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "compact";
    const stored = window.localStorage.getItem(DENSITY_KEY);
    return stored === "comfort" ? "comfort" : "compact";
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const lastClickIdx = useRef(-1);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  const rowHeight = density === "compact" ? 32 : 40;

  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp =
        sortKey === "montant_total"
          ? Number(va) - Number(vb)
          : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [orders, sortKey, sortDir]);

  const { totalAmount, overdueAmount, overdueCount } = useMemo(() => {
    let total = 0, overdueTot = 0, cnt = 0;
    for (const o of sorted) {
      const amt = Number(o.montant_total) || 0;
      total += amt;
      if (isOverdue(o)) { overdueTot += amt; cnt++; }
    }
    return { totalAmount: total, overdueAmount: overdueTot, overdueCount: cnt };
  }, [sorted]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const anySelected = selectedIds.size > 0;
  const allSelected = anySelected && selectedIds.size === sorted.length;

  function toggleRow(id: string, idx: number, e: React.MouseEvent) {
    if (e.shiftKey && lastClickIdx.current >= 0) {
      const lo = Math.min(lastClickIdx.current, idx);
      const hi = Math.max(lastClickIdx.current, idx);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) next.add(sorted[i].id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
    lastClickIdx.current = idx;
  }

  function selectAll() { setSelectedIds(new Set(sorted.map((o) => o.id))); }
  function clearSelection() { setSelectedIds(new Set()); lastClickIdx.current = -1; }

  function focusRow(idx: number) {
    const row = tbodyRef.current?.children[idx] as HTMLElement | undefined;
    row?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTableSectionElement>) {
    if (sorted.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(focusIdx + 1, sorted.length - 1);
      setFocusIdx(next);
      focusRow(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(focusIdx - 1, 0);
      setFocusIdx(prev);
      focusRow(prev);
    } else if (e.key === " " && focusIdx >= 0) {
      e.preventDefault();
      const id = sorted[focusIdx].id;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else if ((e.metaKey || e.ctrlKey) && e.key === "a") {
      e.preventDefault();
      selectAll();
    }
  }

  function SortTh({ label, sortK, align = "left" }: { label: string; sortK: SortKey; align?: "left" | "right" }) {
    const active = sortKey === sortK;
    return (
      <th scope="col" style={{ ...TH_STYLE, textAlign: align }}>
        <button
          type="button"
          onClick={() => toggleSort(sortK)}
          aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: active ? "var(--brand-duck-500)" : "var(--fg-3)",
          }}
        >
          {label}
          <span aria-hidden style={{ fontSize: 9, opacity: 0.6 }}>
            {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid rgba(74,98,116,0.12)",
          background: "#fff",
          boxShadow: "var(--shadow-1)",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: ROW_BORDER,
            padding: "5px 10px",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
            {density === "compact" ? "Compact" : "Confort"} · {orders.length} ligne{orders.length !== 1 ? "s" : ""}
          </span>
          <div
            role="group"
            aria-label="Densité des lignes"
            style={{
              display: "inline-flex",
              overflow: "hidden",
              borderRadius: 6,
              border: "1px solid rgba(74,98,116,0.18)",
            }}
          >
            {(["compact", "comfort"] as const).map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                aria-pressed={density === d}
                style={{
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  borderLeft: i > 0 ? "1px solid rgba(74,98,116,0.18)" : "none",
                  background: density === d ? "var(--brand-duck-500)" : "transparent",
                  color: density === d ? "#fff" : "var(--fg-3)",
                }}
              >
                {d === "compact" ? "Compact" : "Confort"}
              </button>
            ))}
          </div>
        </div>

        {/* Scroll area */}
        <div style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)" }}>
          <table style={{ minWidth: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 110 }} />
              <col />{/* client: grows */}
              <col style={{ width: 120 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" style={{ ...TH_STYLE, width: 32, textAlign: "center", padding: 0 }}>
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={anySelected && !allSelected}
                    onChange={() => (anySelected ? clearSelection() : selectAll())}
                    aria-label={anySelected ? "Tout désélectionner" : "Tout sélectionner"}
                  />
                </th>
                <SortTh label="Référence" sortK="reference" />
                <th scope="col" style={{ ...TH_STYLE, textAlign: "left" }}>Client</th>
                <SortTh label="Statut" sortK="statut" />
                <SortTh label="Commande" sortK="date_commande" />
                <SortTh label="Livraison" sortK="date_livraison_prevue" />
                <th scope="col" style={{ ...TH_STYLE, textAlign: "left" }}>Assigné</th>
                <SortTh label="Montant" sortK="montant_total" align="right" />
                <th scope="col" style={{ ...TH_STYLE }} />
              </tr>
            </thead>
            <tbody ref={tbodyRef} onKeyDown={handleKeyDown} data-any-selected={anySelected ? "true" : undefined}>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
                    Chargement…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
                    Aucune commande
                  </td>
                </tr>
              ) : (
                sorted.map((order, idx) => {
                  const overdue = isOverdue(order);
                  const selected = selectedIds.has(order.id);
                  const assigned = (order as unknown as { assigned_to?: string }).assigned_to;
                  const cellBase: React.CSSProperties = {
                    height: rowHeight,
                    borderBottom: ROW_BORDER,
                    padding: "0 8px",
                    verticalAlign: "middle",
                  };
                  return (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      onFocus={() => setFocusIdx(idx)}
                      className="order-row"
                      style={{
                        background: selected ? "rgba(107,129,145,0.06)" : "transparent",
                        outline: "none",
                      }}
                    >
                      {/* Checkbox */}
                      <td
                        style={{ ...cellBase, width: 32, textAlign: "center", padding: 0 }}
                        className="order-row__check"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {}}
                          onClick={(e) => { e.stopPropagation(); toggleRow(order.id, idx, e as unknown as React.MouseEvent); }}
                          aria-label={`Sélectionner ${order.reference}`}
                          style={{ cursor: "pointer", accentColor: "var(--brand-duck-500)" }}
                        />
                      </td>

                      {/* Référence */}
                      <td style={{ ...cellBase, fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--brand-duck-500)", whiteSpace: "nowrap" }}>
                        {order.reference}
                      </td>

                      {/* Client */}
                      <td style={{ ...cellBase, fontSize: 14, fontWeight: 700, color: "var(--fg-1)", overflow: "hidden", maxWidth: 0 }}>
                        <div
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={order.client?.nom ?? "—"}
                        >
                          {order.client?.nom ?? "—"}
                        </div>
                      </td>

                      {/* Statut */}
                      <td style={cellBase}>
                        <StatusBadge status={order.statut} overdue={overdue} />
                      </td>

                      {/* Commande date */}
                      <td style={{ ...cellBase, fontSize: 13, fontWeight: 500, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(order.date_commande)}
                      </td>

                      {/* Livraison date */}
                      <td style={{ ...cellBase, fontSize: 13, fontWeight: overdue ? 700 : 500, color: overdue ? "var(--color-danger)" : "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {formatDate(order.date_livraison_prevue)}
                          {overdue && <IconTriangleAlert />}
                        </span>
                      </td>

                      {/* Assigné */}
                      <td style={cellBase}>
                        <AssigneePips assigned={assigned} />
                      </td>

                      {/* Montant */}
                      <td style={{ ...cellBase, fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--fg-1)" }}>
                        {formatCurrency(Number(order.montant_total) || 0)}
                      </td>

                      {/* Actions (hover only) */}
                      <td style={{ ...cellBase, textAlign: "right", padding: "0 6px" }} className="order-row__actions">
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <button
                            type="button"
                            title="Composer BAT"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: "none",
                              background: "transparent",
                              color: "var(--fg-3)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "default",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconFilePlus />
                          </button>
                          <button
                            type="button"
                            title="Plus d'actions"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: "none",
                              background: "transparent",
                              color: "var(--fg-3)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "default",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconMoreHorizontal />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Sticky footer */}
        <div
          style={{
            borderTop: ROW_BORDER,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--fg-3)",
            background: "#FAFAFA",
            flexShrink: 0,
          }}
        >
          <span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "monospace", fontWeight: 600, color: "var(--fg-2)" }}>
              {sorted.length}
            </span>{" "}
            commande{sorted.length !== 1 ? "s" : ""}
          </span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
            {formatCurrency(totalAmount)}
          </span>
          {overdueCount > 0 && (
            <>
              <span style={{ opacity: 0.35 }}>·</span>
              <span style={{ color: "var(--color-danger)", fontWeight: 500 }}>
                dont{" "}
                <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                  {formatCurrency(overdueAmount)}
                </span>{" "}
                en retard
              </span>
            </>
          )}
        </div>
      </div>

      {anySelected && (
        <BulkActionBar count={selectedIds.size} onClear={clearSelection} />
      )}
    </>
  );
}

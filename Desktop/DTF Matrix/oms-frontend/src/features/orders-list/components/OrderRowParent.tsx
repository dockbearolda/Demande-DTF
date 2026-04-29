import { useEffect, useRef } from "react";
import type { Order } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import {
  orderArticleCount,
  orderBatState,
  orderRefCount,
  orderSecteurs,
} from "../state/filterOrders";
import { BAT_STATE_LABELS, type ColumnId, type Density } from "../types";
import { NEXT_STEP_LABEL } from "../constants";
import { AssigneeAvatar } from "./AssigneeAvatar";
import { DeliveryIndicator } from "./DeliveryIndicator";
import { SecteurTag } from "./SecteurTag";

interface Props {
  order: Order;
  density: Density;
  expanded: boolean;
  selected: boolean;
  visibleColumns: ColumnId[];
  /** CSS grid-template-columns string partagé avec le header. */
  gridTemplate: string;
  onToggleExpand: () => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  rowIndex: number;
  focusedIndex: number;
  onFocusRow: (idx: number) => void;
}

const FORMAT_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const FORMAT_DATE_SHORT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

const FORMAT_DATE_FULL = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 7) return `Il y a ${diff}j`;
  return FORMAT_DATE_SHORT.format(d);
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 140ms var(--ease-snap)",
      }}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconNote() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IconFlame() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1-3.5C10 4 12 2 12 2z" />
    </svg>
  );
}

export function OrderRowParent({
  order,
  density,
  expanded,
  selected,
  visibleColumns,
  gridTemplate,
  onToggleExpand,
  onToggleSelect,
  onOpen,
  rowIndex,
  focusedIndex,
  onFocusRow,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = focusedIndex === rowIndex;

  useEffect(() => {
    if (isFocused) ref.current?.focus();
  }, [isFocused]);

  const secteurs = orderSecteurs(order);
  const batState = orderBatState(order);
  const articleCount = orderArticleCount(order);
  const refCount = orderRefCount(order);
  const rowH = density === "compact" ? 36 : 56;

  function handleClick(e: React.MouseEvent) {
    if (e.detail >= 3) {
      e.preventDefault();
      onOpen();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "Enter") {
      e.preventDefault();
      onOpen();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen();
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      onToggleExpand();
    }
  }

  return (
    <div
      ref={ref}
      role="row"
      tabIndex={0}
      aria-selected={selected}
      aria-expanded={expanded}
      onClick={handleClick}
      onFocus={() => onFocusRow(rowIndex)}
      onKeyDown={handleKeyDown}
      style={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        height: rowH,
        background: rowBg(selected, isFocused),
        borderBottom: "1px solid rgba(74,98,116,0.06)",
        outline: isFocused ? "2px solid var(--brand-duck-300)" : "none",
        outlineOffset: -2,
        cursor: "default",
      }}
    >
      <Cell padding={0} center onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          onClick={onToggleSelect}
          aria-label={`Sélectionner ${order.reference}`}
          style={{ cursor: "pointer", accentColor: "var(--brand-duck-500)" }}
        />
      </Cell>

      <Cell padding={0} center>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={expanded ? "Replier" : "Déplier"}
          style={{
            width: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: expanded ? "var(--brand-duck-500)" : "var(--fg-3)",
            borderRadius: 4,
          }}
        >
          <IconChevron open={expanded} />
        </button>
      </Cell>

      {visibleColumns.map((col) => (
        <ColumnCell
          key={col}
          col={col}
          order={order}
          density={density}
          secteurs={secteurs}
          batState={batState}
          articleCount={articleCount}
          refCount={refCount}
        />
      ))}
    </div>
  );
}

function rowBg(selected: boolean, focused: boolean): string {
  if (selected) return "rgba(107,129,145,0.10)";
  if (focused) return "rgba(107,129,145,0.05)";
  return "transparent";
}

function Cell({
  children,
  padding,
  center,
  onClick,
  style,
}: {
  children: React.ReactNode;
  padding?: number | string;
  center?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: center ? "center" : "flex-start",
        padding: padding ?? "0 10px",
        minWidth: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ColumnCell({
  col,
  order,
  density,
  secteurs,
  batState,
  articleCount,
  refCount,
}: {
  col: ColumnId;
  order: Order;
  density: Density;
  secteurs: ReturnType<typeof orderSecteurs>;
  batState: ReturnType<typeof orderBatState>;
  articleCount: number;
  refCount: number;
}) {
  switch (col) {
    case "reference":
      return (
        <Cell
          style={{
            fontFamily:
              '-apple-system, "SF Mono", ui-monospace, "Roboto Mono", monospace',
            fontSize: 12,
            fontWeight: 600,
            color: "var(--brand-duck-500)",
            whiteSpace: "nowrap",
          }}
        >
          {order.reference}
        </Cell>
      );
    case "client":
      return (
        <Cell>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: density === "comfort" ? 1 : 0,
              minWidth: 0,
              width: "100%",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--fg-1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.005em",
              }}
              title={order.client?.nom ?? "—"}
            >
              {order.client?.nom ?? "—"}
            </span>
            {density === "comfort" && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--fg-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {order.personne_contact || order.telephone || "—"}
                {refCount > 0 && (
                  <>
                    <span style={{ opacity: 0.4, margin: "0 5px" }}>·</span>
                    {refCount} réf{refCount > 1 ? "s" : ""}
                  </>
                )}
              </span>
            )}
          </div>
        </Cell>
      );
    case "statut":
      return (
        <Cell>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: density === "comfort" ? 1 : 0,
              minWidth: 0,
            }}
          >
            <StatusBadge status={order.statut} />
            {density === "comfort" && (
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--fg-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 2,
                }}
              >
                {NEXT_STEP_LABEL[order.statut]}
              </span>
            )}
          </div>
        </Cell>
      );
    case "secteur":
      return (
        <Cell>
          {secteurs.length === 0 ? (
            <span style={{ color: "var(--fg-4)", fontSize: 11 }}>—</span>
          ) : (
            <SecteurTag secteurs={secteurs} size="sm" />
          )}
        </Cell>
      );
    case "livraison":
      return (
        <Cell>
          <DeliveryIndicator order={order} />
        </Cell>
      );
    case "assigne":
      return (
        <Cell center>
          <AssigneeAvatar value={order.assigned_to} size={22} />
        </Cell>
      );
    case "montant":
      return (
        <Cell
          style={{
            justifyContent: "flex-end",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--fg-1)",
            display: "flex",
            whiteSpace: "nowrap",
          }}
        >
          {FORMAT_EUR.format(Number(order.montant_total) || 0)}
        </Cell>
      );
    case "date_creation":
      return (
        <Cell
          style={{
            color: "var(--fg-3)",
            fontVariantNumeric: "tabular-nums",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          {FORMAT_DATE_FULL.format(new Date(order.date_commande))}
        </Cell>
      );
    case "articles_total":
      return (
        <Cell
          style={{
            justifyContent: "flex-end",
            fontVariantNumeric: "tabular-nums",
            color: "var(--fg-2)",
            fontSize: 12,
            display: "flex",
          }}
        >
          {articleCount}
        </Cell>
      );
    case "nb_references":
      return (
        <Cell
          style={{
            justifyContent: "flex-end",
            fontVariantNumeric: "tabular-nums",
            color: "var(--fg-2)",
            fontSize: 12,
            display: "flex",
          }}
        >
          {refCount}
        </Cell>
      );
    case "note":
      return (
        <Cell center>
          {order.notes_globales || order.notes ? (
            <span
              title={order.notes_globales ?? order.notes ?? ""}
              style={{ color: "var(--brand-duck-500)" }}
            >
              <IconNote />
            </span>
          ) : (
            <span style={{ color: "var(--fg-4)" }}>—</span>
          )}
        </Cell>
      );
    case "etape_suivante":
      return (
        <Cell
          style={{
            color: "var(--fg-2)",
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {NEXT_STEP_LABEL[order.statut]}
        </Cell>
      );
    case "derniere_activite":
      return (
        <Cell
          style={{
            color: "var(--fg-3)",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtRelative(order.updated_at)}
        </Cell>
      );
    case "tag_urgence":
      return (
        <Cell center>
          {order.is_urgent ? (
            <span
              title="Urgent"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 5,
                background: "var(--color-urgent-soft)",
                color: "var(--color-urgent)",
              }}
            >
              <IconFlame />
            </span>
          ) : (
            <span style={{ color: "var(--fg-4)", fontSize: 11 }}>—</span>
          )}
        </Cell>
      );
    case "etat_bat":
      return (
        <Cell style={{ color: "var(--fg-2)", fontSize: 11.5 }}>
          {batState ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 7px",
                borderRadius: 4,
                background:
                  batState === "validated"
                    ? "var(--status-accepted)"
                    : batState === "wip"
                      ? "var(--status-facture)"
                      : "var(--status-demande)",
                color: "var(--fg-2)",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {BAT_STATE_LABELS[batState]}
            </span>
          ) : (
            <span style={{ color: "var(--fg-4)" }}>—</span>
          )}
        </Cell>
      );
  }
}

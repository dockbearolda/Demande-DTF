import { forwardRef, useRef, useState } from "react";
import {
  Eye,
  Pencil,
  ArrowRight,
  MoreHorizontal,
  Copy,
  UserPlus,
  Flame,
  Tag,
  Archive,
  Trash2,
  ChevronRight,
} from "lucide-react";
import type { AssignedTo, Order } from "@/lib/types";
import { Popover } from "./Popover";
import { nextStatus } from "../state/statusFlow";

export interface RowActionsHandlers {
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onAdvanceStatus: (order: Order) => void;
  onDuplicate: (order: Order) => void;
  onAssign: (order: Order, assignee: AssignedTo | null) => void;
  onToggleUrgent: (order: Order) => void;
  onTag: (order: Order, tag: string) => void;
  onArchive: (order: Order) => void;
  onDelete: (order: Order) => void;
}

interface Props extends RowActionsHandlers {
  order: Order;
  /** Affiché en permanence si la ligne est focusée ; sinon fade-in au hover. */
  alwaysVisible?: boolean;
}

const TAG_OPTIONS = ["Express", "Réimpression", "VIP", "Cadeau", "Sample"];
const ASSIGNEES: Array<{ value: AssignedTo | null; label: string }> = [
  { value: "L", label: "Loïc" },
  { value: "C", label: "Charlie" },
  { value: "M", label: "Mélina" },
  { value: null, label: "Non assigné" },
];

export function RowActions({
  order,
  alwaysVisible,
  onView,
  onEdit,
  onAdvanceStatus,
  onDuplicate,
  onAssign,
  onToggleUrgent,
  onTag,
  onArchive,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const next = nextStatus(order.statut);

  return (
    <div
      data-row-actions
      onClick={(e) => e.stopPropagation()}
      className="row-actions"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 6px",
        opacity: alwaysVisible ? 1 : 0,
        transition: "opacity 140ms var(--ease-snap)",
        position: "relative",
      }}
    >
      <ActionButton
        title="Voir le détail"
        ariaLabel={`Voir ${order.reference}`}
        onClick={() => onView(order)}
      >
        <Eye size={14} />
      </ActionButton>
      <ActionButton
        title="Éditer"
        ariaLabel={`Éditer ${order.reference}`}
        onClick={() => onEdit(order)}
      >
        <Pencil size={14} />
      </ActionButton>
      <ActionButton
        title={next ? "Avancer au statut suivant" : "Dernière étape atteinte"}
        ariaLabel="Avancer le statut"
        onClick={() => onAdvanceStatus(order)}
        disabled={!next}
      >
        <ArrowRight size={14} />
      </ActionButton>
      <ActionButton
        ref={moreRef}
        title="Plus d'actions"
        ariaLabel="Plus d'actions"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <MoreHorizontal size={14} />
      </ActionButton>

      <Popover
        open={menuOpen}
        anchorRef={moreRef}
        onClose={() => setMenuOpen(false)}
        align="end"
        offsetX={0}
        minWidth={220}
      >
        <MoreMenu
          order={order}
          onClose={() => setMenuOpen(false)}
          onDuplicate={() => onDuplicate(order)}
          onAssign={(a) => onAssign(order, a)}
          onToggleUrgent={() => onToggleUrgent(order)}
          onTag={(t) => onTag(order, t)}
          onArchive={() => onArchive(order)}
          onDelete={() => onDelete(order)}
        />
      </Popover>
    </div>
  );
}

const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    title: string;
    ariaLabel: string;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
  }
>(function ActionButton(
  { title, ariaLabel, onClick, children, disabled },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        background: "transparent",
        border: "none",
        color: "var(--fg-2)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 120ms var(--ease-snap), color 120ms var(--ease-snap)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "rgba(74,98,116,0.08)";
        e.currentTarget.style.color = "var(--brand-duck-500)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--fg-2)";
      }}
    >
      {children}
    </button>
  );
});

function MoreMenu({
  order,
  onClose,
  onDuplicate,
  onAssign,
  onToggleUrgent,
  onTag,
  onArchive,
  onDelete,
}: {
  order: Order;
  onClose: () => void;
  onDuplicate: () => void;
  onAssign: (a: AssignedTo | null) => void;
  onToggleUrgent: () => void;
  onTag: (t: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [submenu, setSubmenu] = useState<"assign" | "tag" | null>(null);

  if (submenu === "assign") {
    return (
      <div style={{ minWidth: 180 }}>
        <SubmenuHeader title="Assigner à…" onBack={() => setSubmenu(null)} />
        {ASSIGNEES.map((a) => (
          <MenuItem
            key={String(a.value)}
            onSelect={() => {
              onAssign(a.value);
              onClose();
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: a.value ? "var(--fg-2)" : "transparent",
                border: a.value ? "none" : "1px dashed var(--brand-sage-100)",
                color: a.value ? "var(--fg-on-primary)" : "var(--fg-4)",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {a.value ?? "—"}
            </span>
            {a.label}
            {order.assigned_to === a.value && (
              <span
                style={{
                  marginLeft: "auto",
                  color: "var(--brand-duck-500)",
                  fontSize: 11,
                }}
              >
                ✓
              </span>
            )}
          </MenuItem>
        ))}
      </div>
    );
  }

  if (submenu === "tag") {
    return (
      <div style={{ minWidth: 180 }}>
        <SubmenuHeader title="Tag…" onBack={() => setSubmenu(null)} />
        {TAG_OPTIONS.map((t) => (
          <MenuItem
            key={t}
            onSelect={() => {
              onTag(t);
              onClose();
            }}
          >
            <Tag size={12} style={{ color: "var(--fg-3)" }} />
            {t}
          </MenuItem>
        ))}
      </div>
    );
  }

  return (
    <div style={{ minWidth: 220 }}>
      <MenuItem
        onSelect={() => {
          onDuplicate();
          onClose();
        }}
      >
        <Copy size={13} style={{ color: "var(--fg-3)" }} />
        Dupliquer
      </MenuItem>
      <MenuItem onSelect={() => setSubmenu("assign")} hasSubmenu>
        <UserPlus size={13} style={{ color: "var(--fg-3)" }} />
        Assigner à…
      </MenuItem>
      <MenuItem
        onSelect={() => {
          onToggleUrgent();
          onClose();
        }}
      >
        <Flame
          size={13}
          style={{
            color: order.is_urgent ? "var(--color-urgent)" : "var(--fg-3)",
            fill: order.is_urgent ? "var(--color-urgent)" : "transparent",
          }}
        />
        {order.is_urgent ? "Retirer urgent" : "Marquer urgent"}
      </MenuItem>
      <MenuItem onSelect={() => setSubmenu("tag")} hasSubmenu>
        <Tag size={13} style={{ color: "var(--fg-3)" }} />
        Tag…
      </MenuItem>
      <Separator />
      <MenuItem
        onSelect={() => {
          onArchive();
          onClose();
        }}
      >
        <Archive size={13} style={{ color: "var(--fg-3)" }} />
        Archiver
      </MenuItem>
      <MenuItem
        danger
        onSelect={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 size={13} />
        Supprimer
      </MenuItem>
    </div>
  );
}

function MenuItem({
  children,
  onSelect,
  danger,
  hasSubmenu,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "7px 10px",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        fontSize: 12.5,
        color: danger ? "var(--color-danger)" : "var(--fg-1)",
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "rgba(220,38,38,0.08)"
          : "rgba(74,98,116,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
      {hasSubmenu && (
        <ChevronRight
          size={12}
          style={{ marginLeft: "auto", color: "var(--fg-4)" }}
        />
      )}
    </button>
  );
}

function SubmenuHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 10px",
        background: "transparent",
        border: "none",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--fg-3)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
        <ChevronRight size={11} />
      </span>
      {title}
    </button>
  );
}

function Separator() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(74,98,116,0.10)",
        margin: "4px 0",
      }}
    />
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  useDeleteOrder,
  useOrder,
  useUpdateOrder,
  useUpdateOrderStatus,
  type OrderUpdatePayload,
} from "@/hooks/useOrders";
import { useToast } from "@/components/Toast";
import { formatPhoneNumber } from "@/lib/utils";
import {
  SECTEURS,
  SECTEUR_LABELS,
  STATUS_LABELS,
  type AssignedTo,
  type Order,
  type OrderLine,
  type OrderStatus,
  type Secteur,
} from "@/lib/types";

/* =========================================================================
   Constants — kept local to the drawer to avoid coupling to NewOrderModal.
   ========================================================================= */

interface Operator {
  value: AssignedTo;
  initial: string;
  name: string;
  gradient: string;
}

const OPERATORS: Operator[] = [
  { value: "L", initial: "L", name: "Loïc", gradient: "linear-gradient(135deg, #4A6274 0%, #6B8191 100%)" },
  { value: "C", initial: "C", name: "Charlie", gradient: "linear-gradient(135deg, #556876 0%, #4A6274 100%)" },
  { value: "M", initial: "M", name: "Mélina", gradient: "linear-gradient(135deg, #6B8191 0%, #556876 100%)" },
];

// Mirror of `ALLOWED_TRANSITIONS` in app/services/kanban_service.py. The
// backend remains the source of truth; we still surface 409 errors inline if
// the two ever diverge.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "EN_ATTENTE_SOURCING", "EN_ATTENTE_BAT", "CANCELLED"],
  EN_ATTENTE_SOURCING: ["EN_ATTENTE_BAT", "CONFIRMED", "CANCELLED"],
  EN_ATTENTE_BAT: ["BAT_SENT", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["BAT_SENT", "SHIPPED", "CANCELLED"],
  BAT_SENT: ["BAT_APPROVED", "IN_PRODUCTION", "CANCELLED"],
  BAT_APPROVED: ["SHIPPED", "IN_PRODUCTION", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const DATE_SHORTCUTS: { label: string; days: number; danger?: boolean }[] = [
  { label: "Demain", days: 1, danger: true },
  { label: "+3j", days: 3 },
  { label: "+5j", days: 5 },
  { label: "+7j", days: 7 },
  { label: "+15j", days: 15 },
];

const LINE_CELL_INPUT: React.CSSProperties = {
  height: 30,
  width: "100%",
  borderRadius: 6,
  border: "1px solid transparent",
  background: "transparent",
  padding: "0 6px",
  fontSize: 12.5,
  color: "var(--fg-1)",
};
const LINE_CELL_INPUT_NUM: React.CSSProperties = {
  ...LINE_CELL_INPUT,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

/* =========================================================================
   Types
   ========================================================================= */

interface DraftLine {
  // `null` for newly-added rows; carrying the original id helps when we ever
  // want to preserve identity across renders, even though the backend replaces
  // the whole collection on PUT.
  id: string | null;
  secteur: Secteur | "";
  produit: string;
  quantite: number;
  prix_unitaire: string; // kept as string so the input can hold partial values
  notes: string;
}

interface DraftHeader {
  is_urgent: boolean;
  assigned_to: AssignedTo | null;
  date_livraison_prevue: string; // YYYY-MM-DD or ""
  personne_contact: string;
  telephone: string;
  notes_globales: string;
  lines: DraftLine[];
}

interface Props {
  orderId: string | null;
  onClose: () => void;
}

/* =========================================================================
   Helpers
   ========================================================================= */

function lineFromServer(l: OrderLine): DraftLine {
  return {
    id: l.id,
    secteur: l.secteur,
    produit: l.produit,
    quantite: l.quantite,
    prix_unitaire: l.prix_unitaire ?? "0",
    notes: l.notes ?? "",
  };
}

function emptyLine(): DraftLine {
  return {
    id: null,
    secteur: "",
    produit: "",
    quantite: 1,
    prix_unitaire: "0",
    notes: "",
  };
}

function snapshotFromOrder(o: Order): DraftHeader {
  return {
    is_urgent: !!o.is_urgent,
    assigned_to: o.assigned_to ?? null,
    date_livraison_prevue: o.date_livraison_prevue
      ? o.date_livraison_prevue.slice(0, 10)
      : "",
    personne_contact: o.personne_contact ?? "",
    telephone: o.telephone ?? "",
    notes_globales: o.notes_globales ?? "",
    lines: (o.lines ?? []).map(lineFromServer),
  };
}

function normalizeLineForCompare(l: DraftLine) {
  return {
    secteur: l.secteur,
    produit: l.produit.trim(),
    quantite: Number(l.quantite) || 0,
    prix_unitaire: Number(l.prix_unitaire) || 0,
    notes: l.notes.trim(),
  };
}

function linesEqual(a: DraftLine[], b: DraftLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = normalizeLineForCompare(a[i]);
    const y = normalizeLineForCompare(b[i]);
    if (
      x.secteur !== y.secteur ||
      x.produit !== y.produit ||
      x.quantite !== y.quantite ||
      x.prix_unitaire !== y.prix_unitaire ||
      x.notes !== y.notes
    ) {
      return false;
    }
  }
  return true;
}

function headersEqual(a: DraftHeader, b: DraftHeader): boolean {
  return (
    a.is_urgent === b.is_urgent &&
    a.assigned_to === b.assigned_to &&
    a.date_livraison_prevue === b.date_livraison_prevue &&
    a.personne_contact.trim() === b.personne_contact.trim() &&
    a.telephone.trim() === b.telephone.trim() &&
    a.notes_globales.trim() === b.notes_globales.trim() &&
    linesEqual(a.lines, b.lines)
  );
}

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function extractApiError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
    return err.message;
  }
  return err instanceof Error ? err.message : null;
}

/* =========================================================================
   Tiny inline icons
   ========================================================================= */

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const IC_X = "M18 6 6 18M6 6l12 12";
const IC_TRASH =
  "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z";
const IC_PLUS = "M12 5v14M5 12h14";
const IC_FLAME =
  "M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1-3.5C10 4 12 2 12 2zM6 14c0 4 3 7 6 7s6-3 6-7";

/* =========================================================================
   Focus trap (mirrors the helper in NewOrderModal)
   ========================================================================= */

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab" || !el) return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((n) => !n.hasAttribute("disabled") && n.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    el.addEventListener("keydown", handler as unknown as EventListener);
    return () =>
      el.removeEventListener("keydown", handler as unknown as EventListener);
  }, [active, containerRef]);
}

/* =========================================================================
   Confirm dialog (also used for the double-confirm delete)
   ========================================================================= */

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1200] flex items-center justify-center"
    >
      <div
        className="absolute inset-0"
        onClick={onCancel}
        style={{ background: "rgba(32,41,48,0.45)" }}
      />
      <div
        className="relative w-[380px] rounded-[12px] bg-white p-5"
        style={{ boxShadow: "0 24px 64px rgba(32,41,48,0.28)" }}
      >
        <h3 className="text-[14px] font-semibold" style={{ color: "var(--fg-1)" }}>
          {title}
        </h3>
        <p className="mt-1 text-[12px]" style={{ color: "var(--fg-3)" }}>
          {body}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-[8px] px-3 text-[12.5px]"
            style={{ color: "var(--fg-3)" }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold text-white"
            style={{ background: danger ? "var(--color-danger)" : "var(--brand-duck-500)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* =========================================================================
   OperatorPicker — local copy (do not refactor NewOrderModal)
   ========================================================================= */

function OperatorPicker({
  value,
  onChange,
}: {
  value: AssignedTo | null;
  onChange: (v: AssignedTo | null) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Assigné à"
      className="inline-flex h-10 w-full rounded-[10px] p-1"
      style={{ background: "rgba(107,129,145,0.10)" }}
    >
      {OPERATORS.map((op) => {
        const selected = value === op.value;
        return (
          <button
            key={op.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : op.value)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 text-[12.5px] transition-all duration-200 active:scale-[0.97]"
            style={{
              background: selected ? "white" : "transparent",
              boxShadow: selected ? "0 1px 2px rgba(32,41,48,0.08)" : "none",
              color: selected ? "var(--fg-1)" : "var(--fg-3)",
              fontWeight: selected ? 600 : 500,
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: op.gradient }}
            >
              {op.initial}
            </span>
            <span className="truncate">{op.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   StatusSegmented — segmented control honoring valid transitions
   ========================================================================= */

function StatusSegmented({
  current,
  pending,
  onPick,
}: {
  current: OrderStatus;
  pending: boolean;
  onPick: (next: OrderStatus) => void;
}) {
  const allowedNext = ALLOWED_TRANSITIONS[current] ?? [];
  // Show the current status plus all reachable ones, in the canonical order.
  const visible: OrderStatus[] = useMemo(() => {
    const set = new Set<OrderStatus>([current, ...allowedNext]);
    const order: OrderStatus[] = [
      "DRAFT",
      "CONFIRMED",
      "IN_PRODUCTION",
      "BAT_SENT",
      "BAT_APPROVED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];
    return order.filter((s) => set.has(s));
  }, [current, allowedNext]);

  return (
    <div
      role="radiogroup"
      aria-label="Statut"
      className="flex flex-wrap gap-1 rounded-[10px] p-1"
      style={{ background: "rgba(107,129,145,0.10)" }}
    >
      {visible.map((s) => {
        const selected = s === current;
        const allowed = selected || allowedNext.includes(s);
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!allowed || pending || selected}
            onClick={() => onPick(s)}
            className="rounded-[7px] px-2.5 py-1 text-[11.5px] transition-all duration-200 disabled:cursor-not-allowed"
            style={{
              background: selected ? "white" : "transparent",
              boxShadow: selected ? "0 1px 2px rgba(32,41,48,0.08)" : "none",
              color: selected
                ? "var(--fg-1)"
                : allowed
                  ? "var(--fg-2)"
                  : "var(--fg-4)",
              fontWeight: selected ? 600 : 500,
              opacity: !allowed && !selected ? 0.45 : 1,
            }}
          >
            {STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   LineEditor — table mirroring LineItemsEditor with prix_unitaire support
   ========================================================================= */

function LinesEditor({
  items,
  onChange,
}: {
  items: DraftLine[];
  onChange: (next: DraftLine[]) => void;
}) {
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);

  const add = useCallback(() => {
    const next = [...items, emptyLine()];
    onChange(next);
    requestAnimationFrame(() => {
      const el = qtyRefs.current[next.length - 1];
      el?.focus();
      el?.select();
    });
  }, [items, onChange]);

  function update(i: number, patch: Partial<DraftLine>) {
    onChange(items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  const total = useMemo(
    () =>
      items.reduce(
        (s, l) => s + (Number(l.prix_unitaire) || 0) * (Number(l.quantite) || 0),
        0,
      ),
    [items],
  );

  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{ borderColor: "var(--brand-sage-100)" }}
    >
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr style={{ background: "var(--brand-paper-hi)" }}>
            <th
              className="border-b px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-3)", width: 56 }}
            >
              Qté
            </th>
            <th
              className="border-b px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-3)", width: 100 }}
            >
              Secteur
            </th>
            <th
              className="border-b px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-3)" }}
            >
              Produit
            </th>
            <th
              className="border-b px-2 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-3)", width: 80 }}
            >
              PU €
            </th>
            <th
              className="border-b px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-3)" }}
            >
              Note
            </th>
            <th
              className="border-b px-1 py-2"
              style={{ borderColor: "var(--brand-sage-100)", width: 28 }}
              aria-label=""
            />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-2.5 py-5 text-center text-[12px]"
                style={{ color: "var(--fg-4)" }}
              >
                Aucune ligne. Ajoute un produit ci-dessous.
              </td>
            </tr>
          )}
          {items.map((l, i) => (
            <tr key={l.id ?? `new-${i}`} className="border-t" style={{ borderColor: "var(--brand-sage-100)" }}>
              <td className="px-1.5 py-1">
                <input
                  ref={(el) => (qtyRefs.current[i] = el)}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={l.quantite || ""}
                  onChange={(e) => update(i, { quantite: Number(e.target.value) || 0 })}
                  style={LINE_CELL_INPUT_NUM}
                />
              </td>
              <td className="px-1.5 py-1">
                <select
                  value={l.secteur}
                  onChange={(e) => update(i, { secteur: e.target.value as Secteur | "" })}
                  style={LINE_CELL_INPUT}
                >
                  <option value="">—</option>
                  {SECTEURS.map((s) => (
                    <option key={s} value={s}>
                      {SECTEUR_LABELS[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-1.5 py-1">
                <input
                  type="text"
                  value={l.produit}
                  onChange={(e) => update(i, { produit: e.target.value })}
                  placeholder="Produit"
                  style={LINE_CELL_INPUT}
                />
              </td>
              <td className="px-1.5 py-1">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={l.prix_unitaire}
                  onChange={(e) => update(i, { prix_unitaire: e.target.value })}
                  style={LINE_CELL_INPUT_NUM}
                />
              </td>
              <td className="px-1.5 py-1">
                <input
                  type="text"
                  value={l.notes}
                  onChange={(e) => update(i, { notes: e.target.value })}
                  placeholder="Optionnel"
                  style={LINE_CELL_INPUT}
                />
              </td>
              <td className="px-1 py-1">
                <button
                  type="button"
                  aria-label={`Supprimer ligne ${i + 1}`}
                  onClick={() => remove(i)}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                  style={{ color: "var(--fg-4)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(220,38,38,0.08)";
                    e.currentTarget.style.color = "var(--color-danger)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--fg-4)";
                  }}
                >
                  <Icon d={IC_TRASH} size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className="flex items-center justify-between border-t px-2.5 py-2"
        style={{ background: "var(--brand-paper-hi)", borderColor: "var(--brand-sage-100)" }}
      >
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-[6px] px-2 py-1 text-[12.5px] font-medium"
          style={{ color: "var(--brand-duck-500)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(107,129,145,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon d={IC_PLUS} size={13} />
          <span>Ajouter une ligne</span>
        </button>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--fg-3)" }}
          >
            Total
          </span>
          <span
            className="font-mono text-[13px] font-bold tabular-nums"
            style={{ color: "var(--fg-1)" }}
          >
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   OrderEditDrawer
   ========================================================================= */

export function OrderEditDrawer({ orderId, onClose }: Props) {
  const open = !!orderId;
  const { data: order } = useOrder(orderId ?? undefined);
  const updateOrder = useUpdateOrder();
  const updateStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();
  const toast = useToast();

  const [snapshot, setSnapshot] = useState<DraftHeader | null>(null);
  const [draft, setDraft] = useState<DraftHeader | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Hydrate snapshot/draft from server. Re-runs when the targeted order id
  // changes (so re-opening the drawer for a cached row still rehydrates) and
  // when the cached `order` reference itself updates after a save.
  useEffect(() => {
    if (!orderId) {
      setSnapshot(null);
      setDraft(null);
      setSubmitting(false);
      setStatusError(null);
      setConfirmDiscard(false);
      setConfirmDelete(false);
      return;
    }
    if (!order || order.id !== orderId) return;
    const snap = snapshotFromOrder(order);
    setSnapshot(snap);
    setDraft((d) => (d == null ? snap : d));
    setStatusError(null);
  }, [orderId, order]);

  // Body scroll lock while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useFocusTrap(panelRef, open);

  const dirty = useMemo(() => {
    if (!snapshot || !draft) return false;
    return !headersEqual(snapshot, draft);
  }, [snapshot, draft]);

  const requestClose = useCallback(() => {
    if (submitting) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [submitting, dirty, onClose]);

  const patch = useCallback((p: Partial<DraftHeader>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }, []);

  const buildPayload = useCallback((): OrderUpdatePayload => {
    if (!snapshot || !draft) return {};
    const out: OrderUpdatePayload = {};
    if (snapshot.is_urgent !== draft.is_urgent) out.is_urgent = draft.is_urgent;
    if (snapshot.assigned_to !== draft.assigned_to) out.assigned_to = draft.assigned_to;
    if (snapshot.date_livraison_prevue !== draft.date_livraison_prevue) {
      out.date_livraison_prevue = draft.date_livraison_prevue || null;
    }
    if (snapshot.personne_contact.trim() !== draft.personne_contact.trim()) {
      out.personne_contact = draft.personne_contact.trim() || null;
    }
    if (snapshot.telephone.trim() !== draft.telephone.trim()) {
      out.telephone = draft.telephone.trim() || null;
    }
    if (snapshot.notes_globales.trim() !== draft.notes_globales.trim()) {
      out.notes_globales = draft.notes_globales.trim() || null;
    }
    if (!linesEqual(snapshot.lines, draft.lines)) {
      out.lines = draft.lines.map((l, idx) => ({
        ligne_numero: idx + 1,
        secteur: (l.secteur || "AUTRES") as Secteur,
        produit: l.produit.trim(),
        quantite: Math.max(1, Number(l.quantite) || 0),
        prix_unitaire: Number(l.prix_unitaire) || 0,
        notes: l.notes.trim() || null,
      }));
    }
    return out;
  }, [snapshot, draft]);

  const linesValid = useMemo(() => {
    if (!draft) return false;
    return draft.lines.every(
      (l) =>
        !!l.secteur &&
        l.produit.trim().length > 0 &&
        Number(l.quantite) >= 1 &&
        Number(l.prix_unitaire) >= 0,
    );
  }, [draft]);

  const submit = useCallback(async () => {
    if (!orderId || !draft || !snapshot) return;
    if (!dirty || submitting) return;
    if (!linesValid) {
      toast.show("Vérifie les lignes : secteur, produit, quantité ≥ 1.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const updated = await updateOrder.mutateAsync({ id: orderId, data: payload });
      const fresh = snapshotFromOrder(updated);
      setSnapshot(fresh);
      setDraft(fresh);
      toast.show(`Commande ${updated.reference} mise à jour`, "info");
    } catch (err) {
      const detail = extractApiError(err) ?? "Erreur inconnue";
      toast.show(`Échec de l'enregistrement : ${detail}`, "error");
    } finally {
      setSubmitting(false);
    }
  }, [orderId, draft, snapshot, dirty, submitting, linesValid, buildPayload, updateOrder, toast]);

  const onPickStatus = useCallback(
    async (next: OrderStatus) => {
      if (!orderId || !order) return;
      if (next === order.statut) return;
      setStatusError(null);
      try {
        await updateStatus.mutateAsync({ id: orderId, statut: next });
        toast.show(`Statut : ${STATUS_LABELS[next]}`, "info");
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          const detail = (err.response.data?.detail as string) ?? "transition refusée";
          setStatusError(`Transition de statut non autorisée : ${detail}`);
          return;
        }
        const detail = extractApiError(err) ?? "Erreur inconnue";
        setStatusError(detail);
      }
    },
    [orderId, order, updateStatus, toast],
  );

  const onConfirmDelete = useCallback(async () => {
    if (!orderId) return;
    setConfirmDelete(false);
    try {
      await deleteOrder.mutateAsync(orderId);
      toast.show("Commande supprimée", "info");
      onClose();
    } catch (err) {
      const detail = extractApiError(err) ?? "Erreur inconnue";
      toast.show(`Suppression impossible : ${detail}`, "error");
    }
  }, [orderId, deleteOrder, toast, onClose]);

  // Hotkeys: Escape closes, Cmd/Ctrl+S saves.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (dirty && !submitting && linesValid) submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dirty, submitting, linesValid, requestClose, submit]);

  // Date shortcuts: pre-compute targets once per "today" boundary, not on every
  // render. Using YYYY-MM-DD as the cache key means the memo invalidates exactly
  // once at midnight, never inside a single user session boundary.
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }, []);
  const dateShortcuts = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return DATE_SHORTCUTS.map((s) => ({
      ...s,
      target: addDaysIso(base, s.days),
    }));
  }, [todayKey]);

  if (!open) return null;

  /* ---------------- render ---------------- */

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-edit-title"
    >
      {/* Scrim */}
      <div
        className="olda-scrim absolute inset-0"
        style={{
          background: "rgba(74,98,116,0.34)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
        }}
        onClick={requestClose}
      />

      {/* Panel — slide-in from the right */}
      <div
        ref={panelRef}
        className="oms-edit-drawer fixed right-0 top-0 flex h-full flex-col"
        style={{
          width: "min(520px, 100vw)",
          background: "rgba(244,244,242,0.98)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          boxShadow: "-24px 0 60px rgba(32,41,48,0.22)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between border-b"
          style={{ padding: "16px 20px 12px", borderColor: "rgba(74,98,116,0.1)" }}
        >
          <div>
            <h2
              id="order-edit-title"
              className="text-[14px] font-bold"
              style={{ color: "var(--fg-1)" }}
            >
              Modifier la commande
            </h2>
            <p
              className="mt-0.5 font-mono text-[11px]"
              style={{ color: "var(--fg-3)" }}
            >
              {order?.reference ?? "—"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={requestClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border bg-white"
            style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-3)" }}
          >
            <Icon d={IC_X} size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "18px 20px" }}>
          {!order || !draft ? (
            <div
              className="flex h-40 items-center justify-center text-[12.5px]"
              style={{ color: "var(--fg-3)" }}
            >
              Chargement…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section: En-tête */}
              <Section title="En-tête">
                <Field label="Statut">
                  <StatusSegmented
                    current={order.statut}
                    pending={updateStatus.isPending}
                    onPick={onPickStatus}
                  />
                  {statusError && (
                    <p
                      className="mt-1.5 text-[11.5px]"
                      style={{ color: "var(--color-danger)" }}
                    >
                      {statusError}
                    </p>
                  )}
                </Field>

                <Field label="Assigné à">
                  <OperatorPicker
                    value={draft.assigned_to}
                    onChange={(v) => patch({ assigned_to: v })}
                  />
                </Field>

                <Field label="Priorité">
                  <UrgentToggle
                    on={draft.is_urgent}
                    onChange={(v) => patch({ is_urgent: v })}
                  />
                </Field>
              </Section>

              {/* Section: Client */}
              <Section title="Client">
                <Field label="Nom">
                  <div
                    className="flex items-center justify-between rounded-[8px] border bg-white px-3 text-[13px]"
                    style={{
                      borderColor: "var(--brand-sage-100)",
                      color: "var(--fg-1)",
                      height: 36,
                    }}
                  >
                    <span className="truncate">{order.client?.nom ?? "—"}</span>
                    <button
                      type="button"
                      disabled
                      title="Édition du client à venir"
                      className="text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ color: "var(--brand-duck-500)" }}
                    >
                      Modifier le client
                    </button>
                  </div>
                </Field>

                <Field label="Personne à joindre">
                  <TextInput
                    value={draft.personne_contact}
                    onChange={(v) => patch({ personne_contact: v })}
                    placeholder="Optionnel"
                  />
                </Field>

                <Field label="Téléphone">
                  <TextInput
                    value={draft.telephone}
                    onChange={(v) => patch({ telephone: formatPhoneNumber(v) })}
                    placeholder="01 23 45 67 89"
                    inputMode="tel"
                  />
                </Field>
              </Section>

              {/* Section: Livraison */}
              <Section title="Livraison">
                <Field label="Date de livraison prévue">
                  <input
                    type="date"
                    value={draft.date_livraison_prevue}
                    onChange={(e) => patch({ date_livraison_prevue: e.target.value })}
                    className="block h-9 w-full rounded-[8px] border bg-white px-3 font-mono text-[12.5px] tabular-nums"
                    style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-1)" }}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {dateShortcuts.map((s) => {
                      const target = s.target;
                      const sel = draft.date_livraison_prevue === target;
                      return (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() =>
                            patch({ date_livraison_prevue: sel ? "" : target })
                          }
                          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold transition-all duration-150 active:scale-[0.96]"
                          style={{
                            background: sel
                              ? s.danger
                                ? "var(--color-urgent)"
                                : "var(--brand-duck-500)"
                              : s.danger
                                ? "var(--color-urgent-soft)"
                                : "rgba(107,129,145,0.10)",
                            color: sel
                              ? "white"
                              : s.danger
                                ? "var(--color-urgent-ink)"
                                : "var(--fg-2)",
                          }}
                        >
                          {s.danger && (
                            <span
                              aria-hidden="true"
                              className="block h-1.5 w-1.5 rounded-full"
                              style={{ background: sel ? "white" : "var(--color-urgent)" }}
                            />
                          )}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </Section>

              {/* Section: Lignes produits */}
              <Section title="Lignes produits">
                <LinesEditor
                  items={draft.lines}
                  onChange={(lines) => patch({ lines })}
                />
              </Section>

              {/* Section: Notes globales */}
              <Section title="Notes globales">
                <textarea
                  value={draft.notes_globales}
                  onChange={(e) => patch({ notes_globales: e.target.value })}
                  rows={3}
                  placeholder="Spécifications, remarques de production…"
                  className="block w-full rounded-[8px] border bg-white px-3 py-2 text-[12.5px] placeholder:text-[color:var(--fg-4)]"
                  style={{
                    borderColor: "var(--brand-sage-100)",
                    color: "var(--fg-1)",
                    resize: "vertical",
                  }}
                />
              </Section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t"
          style={{
            padding: "12px 20px 16px",
            borderColor: "rgba(74,98,116,0.1)",
            background: "rgba(255,255,255,0.4)",
          }}
        >
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={submitting || deleteOrder.isPending || !order}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: "var(--color-danger)",
              color: "var(--color-danger)",
              background: "transparent",
            }}
          >
            <Icon d={IC_TRASH} size={13} />
            Supprimer
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="h-9 rounded-[8px] border px-3 text-[12px] font-medium disabled:opacity-40"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-2)",
                background: "white",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!dirty || submitting || !linesValid}
              className="h-9 rounded-[8px] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
              style={{
                background: "var(--brand-duck-500)",
                cursor: !dirty || submitting || !linesValid ? "not-allowed" : "default",
              }}
            >
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Abandonner les modifications ?"
        body="Les changements non enregistrés seront perdus."
        confirmLabel="Fermer"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette commande ?"
        body="La commande sera archivée (suppression logique). Cette action peut être annulée côté serveur."
        confirmLabel="Supprimer"
        danger
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <style>{`
        @keyframes oms-drawer-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .oms-edit-drawer {
          animation: oms-drawer-in 340ms var(--ease-snap);
          will-change: transform;
        }
        @media (max-width: 540px) {
          .oms-edit-drawer { width: 100vw !important; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/* =========================================================================
   Tiny presentational helpers
   ========================================================================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3
        className="text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: "var(--fg-3)" }}
      >
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="mb-1 block text-[11px] font-medium"
        style={{ color: "var(--fg-3)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  return (
    <input
      type="text"
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block h-9 w-full rounded-[8px] border bg-white px-3 text-[13px] placeholder:text-[color:var(--fg-4)]"
      style={{ borderColor: "var(--brand-sage-100)", color: "var(--fg-1)" }}
    />
  );
}

function UrgentToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-[8px] border px-3 text-[12.5px] transition-colors select-none"
      style={{
        background: on ? "var(--color-urgent-soft)" : "white",
        borderColor: on ? "var(--color-urgent)" : "var(--brand-sage-100)",
        color: on ? "var(--color-urgent-ink)" : "var(--fg-2)",
        fontWeight: on ? 600 : 500,
      }}
    >
      <Icon d={IC_FLAME} size={14} />
      <span>Urgent</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Marquer comme urgent"
        onClick={() => onChange(!on)}
        className="relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full transition-colors duration-200"
        style={{ background: on ? "var(--color-urgent)" : "rgba(74,98,116,0.22)" }}
      >
        <span
          className="inline-block h-[18px] w-[18px] transform rounded-full bg-white transition-transform duration-200"
          style={{
            transform: on ? "translateX(18px)" : "translateX(2px)",
            boxShadow: "0 1px 3px rgba(32,41,48,0.18)",
          }}
        />
      </button>
    </label>
  );
}

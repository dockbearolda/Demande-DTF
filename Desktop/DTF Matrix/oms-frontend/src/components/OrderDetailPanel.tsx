import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  useOrder,
  useUpdateOrder,
  useUpdateOrderStatus,
} from "@/hooks/useOrders";
import { useBatsForOrder } from "@/hooks/useBats";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { ProcessTimeline } from "@/features/new-order/components/ProcessTimeline";
import {
  STATUS_LABELS,
  type AssignedTo,
  type Order,
  type OrderStatus,
} from "@/lib/types";
import { formatDistanceToNow, formatAbsoluteDateTime } from "@/lib/relativeTime";
import {
  appendAttachment,
  appendComment,
  loadJournal,
  logAssignment,
  logFieldChange,
  logStatusChange,
  removeAttachment,
  type ActivityEvent,
  type OrderAttachment,
  type OrderComment,
  type OrderJournal,
} from "@/lib/orderJournal";
import { getCurrentUser } from "@/lib/currentUser";

/* =========================================================================
   Constants
   ========================================================================= */

const PANEL_DEFAULT_WIDTH = 480;
const PANEL_FULLSCREEN_MAX = 1080;
const RESPONSIVE_BREAKPOINT = 1280;

interface Operator {
  value: AssignedTo;
  initial: string;
  name: string;
}

const OPERATORS: Operator[] = [
  { value: "L", initial: "L", name: "Loïc" },
  { value: "C", initial: "C", name: "Charlie" },
  { value: "M", initial: "M", name: "Mélina" },
];

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

const FORMAT_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

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
const IC_COPY =
  "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2M16 4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4z";
const IC_ARROW_RIGHT = "M5 12h14M13 5l7 7-7 7";
const IC_EDIT =
  "M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z";
const IC_DUPLICATE =
  "M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7l-3-3h-7a2 2 0 0 0-2 2zM4 8v12a2 2 0 0 0 2 2h8";
const IC_PRINT = "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z";
const IC_MORE = "M5 12h.01M12 12h.01M19 12h.01";
const IC_CHEVRON_DOWN = "m6 9 6 6 6-6";
const IC_CHEVRON_UP = "m18 15-6-6-6 6";
const IC_FLAME =
  "M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1-3.5C10 4 12 2 12 2zM6 14c0 4 3 7 6 7s6-3 6-7";
const IC_EXPAND = "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7";
const IC_COMPRESS = "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7";
const IC_PAPERCLIP =
  "M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48";
const IC_TRASH =
  "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z";
const IC_EYE = "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z";
const IC_CHECK = "m5 12 5 5 9-9";
const IC_USER = "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";

/* =========================================================================
   Props
   ========================================================================= */

interface Props {
  /** Order whose detail to show, or null when closed. */
  orderId: string | null;
  /** Ordered list of order ids in the user's current filtered/sorted view —
   *  used by ↑/↓ navigation and the "3 / 42" counter. */
  navList: string[];
  /** Cached orders keyed by id; if present we render immediately without
   *  waiting on the network. */
  cache: Map<string, Order>;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onOpenEdit: (id: string) => void;
  onDuplicate: (order: Order) => void;
  onPrint: (order: Order) => void;
}

/* =========================================================================
   Small helpers
   ========================================================================= */

function operatorByValue(v: AssignedTo | null): Operator | null {
  if (!v) return null;
  return OPERATORS.find((o) => o.value === v) ?? null;
}

function statusToProcessStage(
  s: OrderStatus,
): "saisie" | "envoi-bat" | "validation-client" | "production" | "livraison" {
  switch (s) {
    case "DRAFT":
    case "EN_ATTENTE_SOURCING":
    case "EN_ATTENTE_BAT":
      return "saisie";
    case "CONFIRMED":
      return "envoi-bat";
    case "BAT_SENT":
      return "validation-client";
    case "BAT_APPROVED":
    case "IN_PRODUCTION":
      return "production";
    case "SHIPPED":
    case "DELIVERED":
      return "livraison";
    case "CANCELLED":
      return "saisie";
  }
}

function nextStatus(current: OrderStatus): OrderStatus | null {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || allowed.length === 0) return null;
  const preferred: Record<OrderStatus, OrderStatus | undefined> = {
    DRAFT: "CONFIRMED",
    EN_ATTENTE_SOURCING: "CONFIRMED",
    EN_ATTENTE_BAT: "BAT_SENT",
    CONFIRMED: "IN_PRODUCTION",
    IN_PRODUCTION: "BAT_SENT",
    BAT_SENT: "BAT_APPROVED",
    BAT_APPROVED: "SHIPPED",
    SHIPPED: "DELIVERED",
    DELIVERED: undefined,
    CANCELLED: undefined,
  };
  const wish = preferred[current];
  if (wish && allowed.includes(wish)) return wish;
  return allowed[0] ?? null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function extractApiError(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    return err.message;
  }
  return err instanceof Error ? err.message : null;
}

/* =========================================================================
   References / BAT state derivation
   ========================================================================= */

interface ReferenceRow {
  id: string;
  code: string;
  produit: string;
  quantite: number;
  secteur: string;
  notes: string | null;
  prixUnitaire: number;
}

function deriveReferences(order: Order | undefined): ReferenceRow[] {
  if (!order || !order.lines) return [];
  return order.lines.map((l, i) => ({
    id: l.id,
    code: `L${String(l.ligne_numero ?? i + 1).padStart(2, "0")}`,
    produit: l.produit,
    quantite: l.quantite,
    secteur: l.secteur,
    notes: l.notes,
    prixUnitaire: Number(l.prix_unitaire) || 0,
  }));
}

/* =========================================================================
   OrderDetailPanel
   ========================================================================= */

export function OrderDetailPanel({
  orderId,
  navList,
  cache,
  onClose,
  onNavigate,
  onOpenEdit,
  onDuplicate,
  onPrint,
}: Props) {
  const open = !!orderId;
  const cachedOrder = orderId ? cache.get(orderId) : undefined;
  const { data: serverOrder } = useOrder(orderId ?? undefined);
  const order = serverOrder ?? cachedOrder;

  const updateOrder = useUpdateOrder();
  const updateStatus = useUpdateOrderStatus();
  const toast = useToast();
  const { data: bats = [] } = useBatsForOrder(orderId ?? undefined);

  const panelRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [batPreview, setBatPreview] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    apercu: true,
    processus: true,
    references: true,
    historique: true,
    commentaires: true,
    pieces: true,
  });

  const toggleSection = useCallback((id: string) => {
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  // ───── Responsive (full-width <1280px) ─────
  useEffect(() => {
    if (typeof window === "undefined") return;
    function check() {
      setIsNarrow(window.innerWidth < RESPONSIVE_BREAKPOINT);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ───── Body scroll lock ─────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ───── Reset transient state when switching orders ─────
  useEffect(() => {
    setStatusError(null);
    setBatPreview(null);
  }, [orderId]);

  // ───── Navigation index in the filtered list ─────
  const navIdx = orderId ? navList.indexOf(orderId) : -1;
  const goPrev = useCallback(() => {
    if (navIdx <= 0) return;
    onNavigate(navList[navIdx - 1]);
  }, [navIdx, navList, onNavigate]);
  const goNext = useCallback(() => {
    if (navIdx < 0 || navIdx >= navList.length - 1) return;
    onNavigate(navList[navIdx + 1]);
  }, [navIdx, navList, onNavigate]);

  // ───── Hotkeys ─────
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const editing =
        tag === "input" ||
        tag === "textarea" ||
        (document.activeElement as HTMLElement | null)?.isContentEditable;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (editing) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFullscreen((v) => !v);
      } else if (e.key === "e" || e.key === "E") {
        if (orderId) {
          e.preventDefault();
          onOpenEdit(orderId);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, orderId, goPrev, goNext, onClose, onOpenEdit]);

  // ───── Inline mutations (header) ─────
  const patchOrder = useCallback(
    async (patch: Parameters<typeof updateOrder.mutateAsync>[0]["data"]) => {
      if (!orderId) return;
      try {
        await updateOrder.mutateAsync({ id: orderId, data: patch });
      } catch (err) {
        const msg = extractApiError(err) ?? "Erreur";
        toast.show(`Échec : ${msg}`, "error");
      }
    },
    [orderId, updateOrder, toast],
  );

  const onChangeAssigned = useCallback(
    async (next: AssignedTo | null) => {
      if (!order || next === order.assigned_to) return;
      await patchOrder({ assigned_to: next });
      logAssignment(order.id, getCurrentUser(), next);
    },
    [order, patchOrder],
  );

  const onChangeUrgent = useCallback(
    async (urgent: boolean) => {
      if (!order || urgent === order.is_urgent) return;
      await patchOrder({ is_urgent: urgent });
      logFieldChange(
        order.id,
        getCurrentUser(),
        urgent ? "Marquée urgente" : "Urgence retirée",
      );
    },
    [order, patchOrder],
  );

  const onChangeDelivery = useCallback(
    async (iso: string) => {
      if (!order) return;
      const next = iso || null;
      const cur = order.date_livraison_prevue?.slice(0, 10) ?? "";
      if (next === (cur || null)) return;
      await patchOrder({ date_livraison_prevue: next });
      logFieldChange(
        order.id,
        getCurrentUser(),
        "Date de livraison modifiée",
        iso || "—",
      );
    },
    [order, patchOrder],
  );

  const onChangeNote = useCallback(
    async (next: string) => {
      if (!order) return;
      const trimmed = next.trim();
      const current = (order.notes_globales ?? "").trim();
      if (trimmed === current) return;
      await patchOrder({ notes_globales: trimmed || null });
      logFieldChange(order.id, getCurrentUser(), "Note modifiée");
    },
    [order, patchOrder],
  );

  const onAdvance = useCallback(async () => {
    if (!order) return;
    const next = nextStatus(order.statut);
    if (!next) return;
    setStatusError(null);
    try {
      await updateStatus.mutateAsync({ id: order.id, statut: next });
      logStatusChange(order.id, getCurrentUser(), order.statut, next);
      toast.show(`Statut : ${STATUS_LABELS[next]}`, "info");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const detail =
          (err.response.data?.detail as string) ?? "transition refusée";
        setStatusError(`Transition non autorisée : ${detail}`);
        return;
      }
      setStatusError(extractApiError(err) ?? "Erreur inconnue");
    }
  }, [order, updateStatus, toast]);

  // ───── Header copy ─────
  const onCopyRef = useCallback(() => {
    if (!order) return;
    if (typeof navigator !== "undefined" && "clipboard" in navigator) {
      navigator.clipboard.writeText(order.reference).catch(() => undefined);
      toast.show("Référence copiée", "info");
    }
  }, [order, toast]);

  // ───── Compute width ─────
  const panelWidth: string | number = useMemo(() => {
    if (isNarrow) return "100vw";
    if (fullscreen) return `min(${PANEL_FULLSCREEN_MAX}px, calc(100vw - 64px))`;
    return PANEL_DEFAULT_WIDTH;
  }, [isNarrow, fullscreen]);

  // ───── Stable callbacks for memoized children ─────
  const handlePreviewBat = useCallback((url: string) => setBatPreview(url), []);
  const handleClosePreview = useCallback(() => setBatPreview(null), []);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
    >
      <div
        className={`oms-detail-scrim absolute inset-0 ${
          fullscreen ? "is-fullscreen" : ""
        }`}
        onClick={onClose}
        style={{
          background: fullscreen
            ? "rgba(32,41,48,0.42)"
            : "rgba(32,41,48,0.18)",
          backdropFilter: fullscreen
            ? "blur(8px) saturate(140%)"
            : "blur(2px) saturate(120%)",
          WebkitBackdropFilter: fullscreen
            ? "blur(8px) saturate(140%)"
            : "blur(2px) saturate(120%)",
        }}
      />

      <div
        ref={panelRef}
        className={`oms-detail-panel ${fullscreen ? "is-fullscreen" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          right: fullscreen && !isNarrow ? "50%" : 0,
          transform:
            fullscreen && !isNarrow ? "translateX(50%)" : "translateX(0)",
          height: "100vh",
          width: panelWidth,
          background: "rgba(244,244,242,0.96)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          boxShadow: "-32px 0 80px rgba(32,41,48,0.22)",
          borderLeft: "1px solid rgba(74,98,116,0.10)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DetailHeader
          order={order}
          navIdx={navIdx}
          navTotal={navList.length}
          fullscreen={fullscreen}
          onPrev={goPrev}
          onNext={goNext}
          onCopyRef={onCopyRef}
          onAdvance={onAdvance}
          advancePending={updateStatus.isPending}
          statusError={statusError}
          onEdit={() => order && onOpenEdit(order.id)}
          onDuplicate={() => order && onDuplicate(order)}
          onPrint={() => order && onPrint(order)}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
          onClose={onClose}
        />

        <div
          className="oms-detail-body"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px 22px 28px",
          }}
        >
          {!order ? (
            <div
              className="flex h-40 items-center justify-center text-[12.5px]"
              style={{ color: "var(--fg-3)" }}
            >
              Chargement…
            </div>
          ) : (
            <div className="space-y-3">
              <CollapsibleSection
                id="apercu"
                title="Aperçu"
                open={openSections.apercu}
                onToggle={toggleSection}
              >
                <ApercuSection
                  order={order}
                  onChangeAssigned={onChangeAssigned}
                  onChangeDelivery={onChangeDelivery}
                  onChangeUrgent={onChangeUrgent}
                  onChangeNote={onChangeNote}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="processus"
                title="Processus"
                open={openSections.processus}
                onToggle={toggleSection}
              >
                <ProcessusSection order={order} />
              </CollapsibleSection>

              <CollapsibleSection
                id="references"
                title={`Références (${order.lines?.length ?? 0})`}
                open={openSections.references}
                onToggle={toggleSection}
              >
                <ReferencesSection
                  order={order}
                  bats={bats}
                  onPreview={handlePreviewBat}
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="historique"
                title="Historique"
                open={openSections.historique}
                onToggle={toggleSection}
              >
                <HistoriqueSection order={order} />
              </CollapsibleSection>

              <CollapsibleSection
                id="commentaires"
                title="Commentaires internes"
                open={openSections.commentaires}
                onToggle={toggleSection}
              >
                <CommentairesSection order={order} />
              </CollapsibleSection>

              <CollapsibleSection
                id="pieces"
                title="Pièces jointes"
                open={openSections.pieces}
                onToggle={toggleSection}
              >
                <PiecesJointesSection order={order} />
              </CollapsibleSection>
            </div>
          )}
        </div>
      </div>

      {batPreview && (
        <BatPreviewLightbox url={batPreview} onClose={handleClosePreview} />
      )}

      <style>{`
        @keyframes oms-detail-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes oms-detail-slide-fs {
          from { opacity: 0; transform: translate(50%, 0) scale(0.985); }
          to   { opacity: 1; transform: translate(50%, 0) scale(1); }
        }
        @keyframes oms-detail-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .oms-detail-panel:not(.is-fullscreen) {
          animation: oms-detail-slide-in 340ms var(--ease-snap);
          will-change: transform;
        }
        .oms-detail-panel.is-fullscreen {
          animation: oms-detail-slide-fs 240ms var(--ease-snap);
          border-radius: 14px;
          height: calc(100vh - 64px) !important;
          top: 32px !important;
          box-shadow: 0 32px 96px rgba(32,41,48,0.32) !important;
        }
        .oms-detail-scrim {
          animation: oms-detail-fade-in 200ms var(--ease-snap);
        }
        .oms-detail-body::-webkit-scrollbar { width: 8px; }
        .oms-detail-body::-webkit-scrollbar-thumb {
          background: rgba(74,98,116,0.18);
          border-radius: 4px;
        }
        .oms-detail-body::-webkit-scrollbar-thumb:hover {
          background: rgba(74,98,116,0.32);
        }
      `}</style>
    </div>,
    document.body,
  );
}

/* =========================================================================
   Header — sticky, ref + status + actions + nav arrows + counter
   ========================================================================= */

function DetailHeader({
  order,
  navIdx,
  navTotal,
  fullscreen,
  onPrev,
  onNext,
  onCopyRef,
  onAdvance,
  advancePending,
  statusError,
  onEdit,
  onDuplicate,
  onPrint,
  onToggleFullscreen,
  onClose,
}: {
  order: Order | undefined;
  navIdx: number;
  navTotal: number;
  fullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCopyRef: () => void;
  onAdvance: () => void;
  advancePending: boolean;
  statusError: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onPrint: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
}) {
  const hasPrev = navIdx > 0;
  const hasNext = navIdx >= 0 && navIdx < navTotal - 1;
  const next = order ? nextStatus(order.statut) : null;
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: "rgba(255,255,255,0.66)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: "1px solid rgba(74,98,116,0.10)",
        padding: "10px 14px 12px 18px",
      }}
    >
      {/* Top row: arrows + counter + actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton
            label="Commande précédente"
            onClick={onPrev}
            disabled={!hasPrev}
            d={IC_CHEVRON_UP}
          />
          <IconButton
            label="Commande suivante"
            onClick={onNext}
            disabled={!hasNext}
            d={IC_CHEVRON_DOWN}
          />
          <span
            className="ml-1 inline-flex font-mono tabular-nums"
            style={{
              fontSize: 11.5,
              color: "var(--fg-3)",
              padding: "0 4px",
            }}
            aria-label="Position dans la liste"
          >
            {navIdx >= 0 ? navIdx + 1 : "—"}{" "}
            <span style={{ opacity: 0.5, margin: "0 2px" }}>/</span>{" "}
            {navTotal}
          </span>
        </div>

        <span style={{ flex: 1 }} />

        <IconButton
          label={fullscreen ? "Réduire" : "Plein écran"}
          d={fullscreen ? IC_COMPRESS : IC_EXPAND}
          onClick={onToggleFullscreen}
        />
        <IconButton label="Imprimer" d={IC_PRINT} onClick={onPrint} />
        <IconButton label="Dupliquer" d={IC_DUPLICATE} onClick={onDuplicate} />
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2.5 text-[11.5px] font-semibold transition-colors"
          style={{
            border: "1px solid var(--brand-sage-100)",
            background: "white",
            color: "var(--fg-2)",
          }}
          title="Éditer (E)"
        >
          <Icon d={IC_EDIT} size={12} />
          Éditer
        </button>

        <div className="relative">
          <IconButton
            label="Plus"
            d={IC_MORE}
            onClick={() => setMoreOpen((v) => !v)}
          />
          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[34px] z-20 w-44 overflow-hidden rounded-[10px] border bg-white"
              style={{
                borderColor: "var(--brand-sage-100)",
                boxShadow: "0 12px 32px rgba(32,41,48,0.18)",
              }}
              onMouseLeave={() => setMoreOpen(false)}
            >
              <MoreItem label="Archiver" disabled />
              <MoreItem label="Exporter en PDF" disabled />
              <MoreItem label="Voir l'audit complet" disabled />
            </div>
          )}
        </div>

        <IconButton
          label="Fermer (Esc)"
          d={IC_X}
          onClick={onClose}
          variant="filled"
        />
      </div>

      {/* Bottom row: ref + status + advance */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onCopyRef}
          className="inline-flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 transition-colors"
          style={{ background: "rgba(74,98,116,0.06)" }}
          title="Copier la référence"
        >
          <span
            id="order-detail-title"
            className="font-mono"
            style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-1)" }}
          >
            {order?.reference ?? "—"}
          </span>
          <Icon d={IC_COPY} size={11} />
        </button>

        {order && <StatusBadge status={order.statut} />}

        {order?.is_urgent && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase"
            style={{
              background: "var(--color-urgent-soft)",
              color: "var(--color-urgent-ink)",
              height: 20,
            }}
          >
            <Icon d={IC_FLAME} size={10} />
            Urgent
          </span>
        )}

        <span style={{ flex: 1 }} />

        {order && next && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={advancePending}
            className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50"
            style={{
              background: "var(--brand-duck-500)",
              color: "var(--fg-on-primary)",
            }}
            title={`Avancer vers ${STATUS_LABELS[next]}`}
          >
            Avancer
            <Icon d={IC_ARROW_RIGHT} size={11} />
          </button>
        )}
      </div>

      {statusError && (
        <p
          className="mt-1.5 text-[11px]"
          style={{ color: "var(--color-danger)" }}
        >
          {statusError}
        </p>
      )}
    </div>
  );
}

function IconButton({
  label,
  d,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  d: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "filled";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] transition-colors disabled:opacity-30"
      style={{
        border:
          variant === "filled"
            ? "1px solid var(--brand-sage-100)"
            : "1px solid transparent",
        background: variant === "filled" ? "white" : "transparent",
        color: "var(--fg-2)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "rgba(74,98,116,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          variant === "filled" ? "white" : "transparent";
      }}
    >
      <Icon d={d} size={13} />
    </button>
  );
}

function MoreItem({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="block w-full px-3 py-1.5 text-left text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ color: "var(--fg-2)" }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "rgba(74,98,116,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}

/* =========================================================================
   Collapsible section
   ========================================================================= */

function CollapsibleSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[12px] border"
      style={{
        borderColor: "rgba(74,98,116,0.10)",
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-t-[12px] px-3 py-2.5"
        style={{ color: "var(--fg-2)" }}
      >
        <span
          className="text-[10.5px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "var(--fg-3)" }}
        >
          {title}
        </span>
        <Icon d={open ? IC_CHEVRON_UP : IC_CHEVRON_DOWN} size={13} />
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </section>
  );
}

/* =========================================================================
   APERÇU section — inline editing
   ========================================================================= */

const ApercuSection = memo(function ApercuSection({
  order,
  onChangeAssigned,
  onChangeDelivery,
  onChangeUrgent,
  onChangeNote,
}: {
  order: Order;
  onChangeAssigned: (v: AssignedTo | null) => void;
  onChangeDelivery: (iso: string) => void;
  onChangeUrgent: (v: boolean) => void;
  onChangeNote: (s: string) => void;
}) {
  const secteursSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of order.lines ?? []) set.add(l.secteur);
    return Array.from(set);
  }, [order]);

  const livIso = order.date_livraison_prevue?.slice(0, 10) ?? "";
  const livDate = livIso ? new Date(livIso) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue =
    livDate &&
    livDate < today &&
    !["DELIVERED", "SHIPPED", "CANCELLED"].includes(order.statut);
  const due =
    livDate && Math.round((livDate.getTime() - today.getTime()) / 86_400_000);

  return (
    <div className="space-y-2.5">
      <Row label="Client">
        <div className="flex items-center justify-between gap-2">
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            {order.client?.nom ?? "—"}
          </span>
          <button
            type="button"
            disabled={!order.client_id}
            className="text-[11px] font-semibold transition-colors disabled:opacity-40"
            style={{ color: "var(--brand-duck-500)" }}
            title="Voir la fiche client"
          >
            Fiche client →
          </button>
        </div>
      </Row>

      <Row label="Assigné">
        <AssigneeInline
          value={order.assigned_to ?? null}
          onChange={onChangeAssigned}
        />
      </Row>

      <Row label="Livraison">
        <DateInline
          iso={livIso}
          onChange={onChangeDelivery}
          overdue={!!overdue}
          dueInDays={due ?? null}
        />
      </Row>

      <Row label="Montant">
        <span
          className="font-mono"
          style={{
            color: "var(--fg-1)",
            fontWeight: 700,
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {FORMAT_EUR.format(Number(order.montant_total) || 0)}
        </span>
      </Row>

      <Row label="Secteurs">
        <div className="flex flex-wrap gap-1">
          {secteursSet.length === 0 ? (
            <span style={{ color: "var(--fg-4)", fontSize: 11.5 }}>—</span>
          ) : (
            secteursSet.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full px-2 text-[10.5px] font-semibold uppercase"
                style={{
                  background: "rgba(107,129,145,0.10)",
                  color: "var(--fg-2)",
                  height: 20,
                  letterSpacing: "0.04em",
                }}
              >
                {s}
              </span>
            ))
          )}
        </div>
      </Row>

      <Row label="Urgent">
        <UrgentInline value={order.is_urgent} onChange={onChangeUrgent} />
      </Row>

      <Row label="Note" align="start">
        <NoteInline
          value={order.notes_globales ?? ""}
          onCommit={onChangeNote}
        />
      </Row>
    </div>
  );
});

function Row({
  label,
  align = "center",
  children,
}: {
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: "100px 1fr",
        alignItems: align === "start" ? "flex-start" : "center",
        minHeight: 28,
      }}
    >
      <div
        className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--fg-3)", paddingTop: align === "start" ? 6 : 0 }}
      >
        {label}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function AssigneeInline({
  value,
  onChange,
}: {
  value: AssignedTo | null;
  onChange: (v: AssignedTo | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const op = operatorByValue(value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[7px] border px-1.5 py-0.5 text-[12px] transition-colors"
        style={{
          borderColor: "transparent",
          background: "rgba(74,98,116,0.04)",
          color: "var(--fg-1)",
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(74,98,116,0.10)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(74,98,116,0.04)";
        }}
      >
        {op ? (
          <>
            <Avatar user={op.value} size="xs" label={op.name} />
            <span>{op.name}</span>
          </>
        ) : (
          <>
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full"
              style={{
                border: "1px dashed var(--brand-sage-100)",
                color: "var(--fg-4)",
                fontSize: 10,
              }}
            >
              —
            </span>
            <span style={{ color: "var(--fg-3)" }}>Non assigné</span>
          </>
        )}
        <Icon d={IC_CHEVRON_DOWN} size={11} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[30px] z-30 w-44 overflow-hidden rounded-[10px] border bg-white"
          style={{
            borderColor: "var(--brand-sage-100)",
            boxShadow: "0 12px 32px rgba(32,41,48,0.18)",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {OPERATORS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors"
              style={{ color: "var(--fg-1)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(74,98,116,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Avatar user={o.value} size="xs" label={o.name} />
              <span>{o.name}</span>
              {value === o.value && (
                <span style={{ marginLeft: "auto", color: "var(--brand-duck-500)" }}>
                  <Icon d={IC_CHECK} size={12} />
                </span>
              )}
            </button>
          ))}
          <div
            style={{
              height: 1,
              background: "var(--brand-sage-100)",
              margin: "2px 0",
            }}
          />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="block w-full px-2.5 py-1.5 text-left text-[12px]"
            style={{ color: "var(--fg-3)" }}
          >
            Désassigner
          </button>
        </div>
      )}
    </div>
  );
}

function DateInline({
  iso,
  onChange,
  overdue,
  dueInDays,
}: {
  iso: string;
  onChange: (iso: string) => void;
  overdue: boolean;
  dueInDays: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelDate = iso ? FORMAT_DATE.format(new Date(iso)) : null;

  let badge: { color: string; bg: string; text: string } | null = null;
  if (iso && overdue) {
    badge = {
      color: "var(--color-danger)",
      bg: "rgba(220,38,38,0.10)",
      text: `J${dueInDays}`,
    };
  } else if (iso && dueInDays != null && dueInDays >= 0 && dueInDays <= 3) {
    badge = {
      color: "var(--color-urgent-ink)",
      bg: "var(--color-urgent-soft)",
      text: dueInDays === 0 ? "Aujourd'hui" : `J+${dueInDays}`,
    };
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.showPicker?.()}
        className="inline-flex items-center gap-1.5 rounded-[7px] px-1.5 py-0.5 text-[12px] transition-colors"
        style={{
          background: "rgba(74,98,116,0.04)",
          color: iso ? "var(--fg-1)" : "var(--fg-4)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
        }}
      >
        {labelDate ?? "—"}
      </button>
      {badge && (
        <span
          className="inline-flex items-center rounded-full px-2 text-[10px] font-bold uppercase"
          style={{ background: badge.bg, color: badge.color, height: 18 }}
        >
          {badge.text}
        </span>
      )}
      <input
        ref={inputRef}
        type="date"
        value={iso}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function UrgentInline({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold transition-all"
      style={{
        background: value ? "var(--color-urgent)" : "rgba(74,98,116,0.06)",
        color: value ? "white" : "var(--fg-2)",
      }}
    >
      <Icon d={IC_FLAME} size={12} />
      {value ? "Urgent" : "Standard"}
    </button>
  );
}

function NoteInline({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (s: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.setSelectionRange(draft.length, draft.length);
    }
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full rounded-[7px] px-2 py-1.5 text-left text-[12.5px] transition-colors"
        style={{
          background: "rgba(74,98,116,0.04)",
          color: value ? "var(--fg-1)" : "var(--fg-4)",
          minHeight: 32,
          whiteSpace: "pre-wrap",
        }}
      >
        {value || "Cliquer pour ajouter une note…"}
      </button>
    );
  }

  function commit() {
    onCommit(draft);
    setEditing(false);
  }

  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(value);
          setEditing(false);
        }
      }}
      rows={3}
      className="block w-full rounded-[7px] border bg-white px-2 py-1.5 text-[12.5px]"
      style={{
        borderColor: "var(--brand-duck-300)",
        color: "var(--fg-1)",
        boxShadow: "var(--focus-ring)",
        resize: "vertical",
      }}
      placeholder="Note de production…"
    />
  );
}

/* =========================================================================
   PROCESSUS section
   ========================================================================= */

const ProcessusSection = memo(function ProcessusSection({ order }: { order: Order }) {
  const stage = statusToProcessStage(order.statut);
  const totalQty = (order.lines ?? []).reduce((s, l) => s + l.quantite, 0);
  return (
    <div className="space-y-1">
      <ProcessTimeline
        compact
        current={stage}
        totalQty={totalQty}
        assignedTo={(order.assigned_to as "L" | "C" | "M") ?? ""}
        isUrgent={order.is_urgent}
        from={new Date(order.date_commande)}
      />
    </div>
  );
});

/* =========================================================================
   RÉFÉRENCES section
   ========================================================================= */

interface BatLike {
  id: string;
  status: string;
  file_name: string;
  decided_at?: string | null;
  created_at: string;
}

const ReferencesSection = memo(function ReferencesSection({
  order,
  bats,
  onPreview,
}: {
  order: Order;
  bats: BatLike[];
  onPreview: (url: string) => void;
}) {
  const refs = deriveReferences(order);
  if (refs.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
        Aucune référence pour cette commande.
      </p>
    );
  }
  // Best-effort BAT mapping: by index — backend doesn't expose a per-line link yet.
  return (
    <div className="space-y-2">
      {refs.map((r, i) => {
        const bat = bats[i] ?? null;
        const batState = bat
          ? bat.status === "APPROVED"
            ? { label: "Validé", tone: "ok" as const }
            : bat.status === "REJECTED"
              ? { label: "Recyclé", tone: "warn" as const }
              : { label: "En cours", tone: "wip" as const }
          : { label: "À créer", tone: "todo" as const };
        return (
          <div
            key={r.id}
            className="flex items-center gap-2.5 rounded-[10px] border p-2"
            style={{
              borderColor: "var(--brand-sage-100)",
              background: "white",
            }}
          >
            <div
              className="flex h-11 w-11 flex-none items-center justify-center rounded-[8px]"
              style={{
                background: "rgba(107,129,145,0.10)",
                color: "var(--fg-3)",
              }}
              aria-hidden="true"
            >
              <Icon d={IC_USER} size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-[10.5px] font-bold"
                  style={{ color: "var(--fg-3)" }}
                >
                  {r.code}
                </span>
                <span
                  className="truncate text-[12.5px] font-semibold"
                  style={{ color: "var(--fg-1)" }}
                >
                  {r.produit || "—"}
                </span>
              </div>
              <div
                className="mt-0.5 flex items-center gap-2 text-[11px]"
                style={{ color: "var(--fg-3)" }}
              >
                <span>{r.secteur}</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.quantite} pcs
                </span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {FORMAT_EUR.format(r.prixUnitaire)} / pc
                </span>
              </div>
            </div>
            <BatStatePill {...batState} />
            <button
              type="button"
              onClick={() => bat && onPreview(`/api/bat/${bat.id}/file`)}
              disabled={!bat}
              className="inline-flex h-7 items-center gap-1 rounded-[7px] border px-2 text-[11px] font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-2)",
                background: "white",
              }}
              title="Voir le BAT"
            >
              <Icon d={IC_EYE} size={11} />
              BAT
            </button>
          </div>
        );
      })}
    </div>
  );
});

function BatStatePill({
  label,
  tone,
}: {
  label: string;
  tone: "todo" | "wip" | "ok" | "warn";
}) {
  const palette: Record<string, { bg: string; fg: string }> = {
    todo: { bg: "rgba(74,98,116,0.06)", fg: "var(--fg-3)" },
    wip: { bg: "var(--status-production)", fg: "var(--fg-1)" },
    ok: { bg: "var(--status-accepted)", fg: "var(--fg-1)" },
    warn: { bg: "var(--color-urgent-soft)", fg: "var(--color-urgent-ink)" },
  };
  const p = palette[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 text-[10.5px] font-bold uppercase"
      style={{
        background: p.bg,
        color: p.fg,
        height: 20,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/* =========================================================================
   HISTORIQUE section
   ========================================================================= */

const HistoriqueSection = memo(function HistoriqueSection({ order }: { order: Order }) {
  const [journal, setJournal] = useState<OrderJournal>(() => loadJournal(order.id));

  useEffect(() => {
    setJournal(loadJournal(order.id));
    const onStorage = () => setJournal(loadJournal(order.id));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [order.id]);

  // Combine server-side facts with local journal events.
  const merged: ActivityEvent[] = useMemo(() => {
    const serverEvents: ActivityEvent[] = [];
    serverEvents.push({
      id: "server-created",
      kind: "created",
      at: order.created_at,
      author: order.assigned_to,
      label: "Commande créée",
      detail: order.reference,
    });
    if (order.updated_at && order.updated_at !== order.created_at) {
      serverEvents.push({
        id: "server-updated",
        kind: "field",
        at: order.updated_at,
        author: order.assigned_to,
        label: "Mise à jour",
      });
    }
    return [...journal.activity, ...serverEvents].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [order, journal]);

  if (merged.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
        Aucun événement.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {merged.map((ev) => (
        <li
          key={ev.id}
          className="flex items-start gap-2.5 rounded-[8px] px-2 py-1.5"
          style={{ background: "rgba(255,255,255,0.55)" }}
        >
          <span
            aria-hidden="true"
            className="mt-1 block h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: kindColor(ev.kind) }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="text-[12.5px] font-semibold"
                style={{ color: "var(--fg-1)" }}
              >
                {ev.label}
              </span>
              <time
                title={formatAbsoluteDateTime(ev.at)}
                className="flex-none text-[10.5px] tabular-nums"
                style={{ color: "var(--fg-3)" }}
              >
                {formatDistanceToNow(ev.at)}
              </time>
            </div>
            {ev.detail && (
              <p
                className="mt-0.5 truncate text-[11.5px]"
                style={{ color: "var(--fg-3)" }}
              >
                {ev.detail}
              </p>
            )}
            {ev.author && (
              <span
                className="mt-0.5 inline-flex items-center gap-1 text-[10.5px]"
                style={{ color: "var(--fg-4)" }}
              >
                par <Avatar user={ev.author} size="xs" />{" "}
                {operatorByValue(ev.author)?.name}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
});

function kindColor(kind: ActivityEvent["kind"]): string {
  switch (kind) {
    case "created":
      return "var(--brand-duck-500)";
    case "status":
      return "var(--brand-duck-300)";
    case "assigned":
      return "var(--brand-duck-400)";
    case "comment":
      return "var(--color-urgent)";
    case "attachment":
      return "var(--brand-sage)";
    default:
      return "var(--fg-4)";
  }
}

/* =========================================================================
   COMMENTAIRES section
   ========================================================================= */

const CommentairesSection = memo(function CommentairesSection({ order }: { order: Order }) {
  const [comments, setComments] = useState<OrderComment[]>(
    () => loadJournal(order.id).comments,
  );
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setComments(loadJournal(order.id).comments);
  }, [order.id]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    const author = (getCurrentUser() ?? "C") as AssignedTo;
    const c = appendComment(order.id, author, text);
    setComments((prev) => [...prev, c]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {comments.length === 0 && (
        <p className="text-[12px]" style={{ color: "var(--fg-4)" }}>
          Aucun commentaire interne. Mentionne @loic, @charlie ou @melina.
        </p>
      )}

      <ul className="space-y-2">
        {comments
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .map((c) => (
            <li
              key={c.id}
              className="rounded-[10px] border p-2"
              style={{
                borderColor: "var(--brand-sage-100)",
                background: "white",
              }}
            >
              <div className="flex items-center gap-2">
                <Avatar user={c.author} size="xs" />
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--fg-1)" }}
                >
                  {operatorByValue(c.author)?.name ?? c.author}
                </span>
                <span style={{ flex: 1 }} />
                <time
                  title={formatAbsoluteDateTime(c.createdAt)}
                  className="text-[10.5px] tabular-nums"
                  style={{ color: "var(--fg-3)" }}
                >
                  {formatDistanceToNow(c.createdAt)}
                </time>
              </div>
              <p
                className="mt-1 text-[12.5px] whitespace-pre-wrap"
                style={{ color: "var(--fg-1)" }}
              >
                {renderWithMentions(c.body)}
              </p>
              {c.mentions.length > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  {c.mentions.map((m) => (
                    <Avatar key={m} user={m} size="xs" />
                  ))}
                </div>
              )}
            </li>
          ))}
      </ul>

      <div
        className="rounded-[10px] border bg-white p-2"
        style={{ borderColor: "var(--brand-sage-100)" }}
      >
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Ajouter un commentaire interne — @loic @charlie @melina"
          className="block w-full resize-none border-none bg-transparent text-[12.5px] outline-none"
          style={{ color: "var(--fg-1)" }}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10.5px]" style={{ color: "var(--fg-4)" }}>
            ⌘+Entrée pour publier
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="h-7 rounded-[7px] px-2.5 text-[11.5px] font-semibold disabled:opacity-40"
            style={{
              background: "var(--brand-duck-500)",
              color: "var(--fg-on-primary)",
            }}
          >
            Publier
          </button>
        </div>
      </div>
    </div>
  );
});

function renderWithMentions(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /@(loic|charlie|melina|loïc|mélina)\b/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span
        key={`m-${key++}`}
        className="inline-flex items-center rounded-full px-1.5 font-semibold"
        style={{
          background: "rgba(107,129,145,0.14)",
          color: "var(--brand-duck-500)",
          fontSize: "0.95em",
        }}
      >
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

/* =========================================================================
   PIÈCES JOINTES section — drag-drop
   ========================================================================= */

const PiecesJointesSection = memo(function PiecesJointesSection({ order }: { order: Order }) {
  const [items, setItems] = useState<OrderAttachment[]>(
    () => loadJournal(order.id).attachments,
  );
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(loadJournal(order.id).attachments);
  }, [order.id]);

  function ingestFiles(fileList: FileList | null | File[]) {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const author = getCurrentUser();
    const next: OrderAttachment[] = [];
    for (const f of files) next.push(appendAttachment(order.id, f, author));
    setItems((prev) => [...prev, ...next]);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          ingestFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-2 border-dashed py-4 text-[12px] transition-colors"
        style={{
          borderColor: dragOver
            ? "var(--brand-duck-500)"
            : "var(--brand-sage-100)",
          background: dragOver ? "rgba(107,129,145,0.06)" : "white",
          color: "var(--fg-3)",
        }}
      >
        <Icon d={IC_PAPERCLIP} size={14} />
        Glisser-déposer un fichier (BAT, photo, bon de livraison)
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          ingestFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2.5 rounded-[8px] border bg-white px-2 py-1.5"
              style={{ borderColor: "var(--brand-sage-100)" }}
            >
              <span
                className="flex h-7 w-7 flex-none items-center justify-center rounded-[6px]"
                style={{
                  background: "rgba(74,98,116,0.06)",
                  color: "var(--fg-3)",
                }}
                aria-hidden="true"
              >
                <Icon d={IC_PAPERCLIP} size={12} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="truncate text-[12px] font-semibold"
                  style={{ color: "var(--fg-1)" }}
                >
                  {a.name}
                </div>
                <div
                  className="text-[10.5px]"
                  style={{ color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatBytes(a.size)} · {formatDistanceToNow(a.uploadedAt)}
                  {a.uploadedBy && ` · ${operatorByValue(a.uploadedBy)?.name}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  removeAttachment(order.id, a.id);
                  setItems((prev) => prev.filter((x) => x.id !== a.id));
                }}
                aria-label="Retirer"
                className="inline-flex h-6 w-6 items-center justify-center rounded-[6px]"
                style={{ color: "var(--fg-4)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(220,38,38,0.10)";
                  e.currentTarget.style.color = "var(--color-danger)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--fg-4)";
                }}
              >
                <Icon d={IC_TRASH} size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

/* =========================================================================
   BAT preview lightbox
   ========================================================================= */

function BatPreviewLightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1500] flex items-center justify-center"
      onClick={onClose}
      style={{
        background: "rgba(20,28,34,0.78)",
        backdropFilter: "blur(8px)",
      }}
    >
      <img
        src={url}
        alt="Aperçu BAT"
        decoding="async"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "calc(100vw - 64px)",
          maxHeight: "calc(100vh - 64px)",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 32px 96px rgba(0,0,0,0.5)",
          background: "white",
        }}
      />
    </div>,
    document.body,
  );
}

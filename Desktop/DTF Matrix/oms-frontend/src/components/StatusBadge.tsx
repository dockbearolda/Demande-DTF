import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

interface Props {
  status: OrderStatus;
  overdue?: boolean;
  className?: string;
}

const BADGE_STYLES: Record<OrderStatus, { bg: string; color: string }> = {
  DRAFT:         { bg: "var(--status-demande)",    color: "var(--fg-3)" },
  CONFIRMED:     { bg: "var(--status-devis)",      color: "var(--fg-2)" },
  BAT_SENT:      { bg: "var(--status-facture)",    color: "var(--fg-2)" },
  BAT_APPROVED:  { bg: "var(--status-accepted)",   color: "var(--fg-1)" },
  IN_PRODUCTION: { bg: "var(--status-production)", color: "var(--fg-1)" },
  SHIPPED:       { bg: "var(--status-paye)",       color: "var(--fg-on-primary)" },
  DELIVERED:     { bg: "var(--brand-duck-500)",    color: "var(--fg-on-primary)" },
  CANCELLED:     { bg: "var(--status-demande)",    color: "var(--fg-4)" },
};

const PILL_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
  lineHeight: 1,
};

export function StatusBadge({ status, overdue, className = "" }: Props) {
  if (overdue) {
    return (
      <span
        className={className}
        style={{
          ...PILL_BASE,
          background: "var(--color-urgent-soft)",
          color: "#a16207",
        }}
        aria-label="Statut : En retard"
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-urgent)",
            flexShrink: 0,
          }}
          aria-hidden
        />
        Retard
      </span>
    );
  }

  const s = BADGE_STYLES[status] ?? BADGE_STYLES.DRAFT;
  return (
    <span
      className={className}
      style={{ ...PILL_BASE, background: s.bg, color: s.color }}
      aria-label={`Statut : ${STATUS_LABELS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

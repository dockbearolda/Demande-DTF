import { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "info" | "warn" | "success" | "danger";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children?: ReactNode;
  dot?: boolean;
}

const TONE: Record<Tone, { bg: string; color: string; dot: string }> = {
  neutral: { bg: "var(--status-demande)", color: "var(--fg-3)", dot: "var(--fg-4)" },
  info: { bg: "var(--status-devis)", color: "var(--fg-2)", dot: "var(--brand-duck-300)" },
  warn: {
    bg: "var(--color-urgent-soft)",
    color: "var(--color-urgent-ink)",
    dot: "var(--color-urgent)",
  },
  success: {
    bg: "var(--status-accepted)",
    color: "var(--fg-1)",
    dot: "var(--brand-duck-500)",
  },
  danger: {
    bg: "rgba(220,38,38,0.10)",
    color: "var(--color-danger)",
    dot: "var(--color-danger)",
  },
};

export function Badge({ tone = "neutral", children, dot, style, ...rest }: Props) {
  const t = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: "var(--r-1)",
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        lineHeight: 1,
        background: t.bg,
        color: t.color,
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: t.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

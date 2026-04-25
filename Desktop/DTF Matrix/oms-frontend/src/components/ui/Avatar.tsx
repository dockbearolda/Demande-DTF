import { HTMLAttributes } from "react";

export type AvatarUser = "L" | "C" | "M" | string;
type Size = "xs" | "sm" | "md";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  user: AvatarUser;
  size?: Size;
  label?: string;
}

const SIZE: Record<Size, { box: number; fs: number }> = {
  xs: { box: 20, fs: 10 },
  sm: { box: 26, fs: 11 },
  md: { box: 32, fs: 13 },
};

// Stable color tint per letter — falls back to duck for unknown.
const TINT: Record<string, { from: string; to: string }> = {
  L: { from: "var(--brand-duck-300)", to: "var(--brand-duck-500)" },
  C: { from: "#A9C1B8", to: "#6E8C83" },
  M: { from: "#C9A78F", to: "#8C6E5A" },
};

function initials(u: AvatarUser): string {
  if (u.length === 1) return u.toUpperCase();
  const parts = u.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || u.slice(0, 2).toUpperCase();
}

export function Avatar({ user, size = "sm", label, style, ...rest }: Props) {
  const s = SIZE[size];
  const tint = TINT[user.toUpperCase()] ?? {
    from: "var(--brand-duck-300)",
    to: "var(--brand-duck-500)",
  };
  return (
    <span
      aria-label={label ?? `Avatar ${user}`}
      role="img"
      style={{
        width: s.box,
        height: s.box,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${tint.from}, ${tint.to})`,
        color: "var(--fg-on-primary)",
        fontSize: s.fs,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        ...style,
      }}
      {...rest}
    >
      {initials(user)}
    </span>
  );
}

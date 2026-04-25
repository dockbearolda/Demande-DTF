import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const SIZE: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
  sm: { h: 28, px: 10, fs: 12, gap: 6 },
  md: { h: 34, px: 14, fs: 13, gap: 8 },
  lg: { h: 40, px: 18, fs: 14, gap: 8 },
};

function variantStyle(v: Variant, disabled: boolean): React.CSSProperties {
  if (v === "primary") {
    return {
      background: disabled ? "var(--brand-duck-300)" : "var(--brand-duck-500)",
      color: "var(--fg-on-primary)",
      border: "1px solid transparent",
    };
  }
  if (v === "secondary") {
    return {
      background: "var(--brand-paper-hi)",
      color: "var(--fg-1)",
      border: "1px solid var(--brand-sage-100)",
    };
  }
  if (v === "ghost") {
    return {
      background: "transparent",
      color: "var(--fg-2)",
      border: "1px solid transparent",
    };
  }
  return {
    background: "var(--color-danger)",
    color: "var(--fg-on-primary)",
    border: "1px solid transparent",
  };
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    disabled,
    children,
    style,
    type = "button",
    ...rest
  },
  ref,
) {
  const s = SIZE[size];
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      data-size={size}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        borderRadius: "var(--r-2)",
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        opacity: isDisabled && !loading ? 0.55 : 1,
        ...variantStyle(variant, !!isDisabled),
        ...style,
      }}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            border: "1.5px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "olda-spin 720ms linear infinite",
          }}
        />
      )}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

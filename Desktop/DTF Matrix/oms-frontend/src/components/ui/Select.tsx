import { SelectHTMLAttributes, forwardRef, ReactNode, useId } from "react";
import { ChevronDown } from "lucide-react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, error, id, style, containerStyle, disabled, children, ...rest },
  ref,
) {
  const autoId = useId();
  const selId = id ?? autoId;
  const hintId = hint ? `${selId}-hint` : undefined;
  const errId = error ? `${selId}-err` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <label
          htmlFor={selId}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--fg-2)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          ref={ref}
          id={selId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          style={{
            width: "100%",
            height: 34,
            padding: "0 34px 0 12px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fg-1)",
            background: disabled ? "var(--brand-sage-50)" : "#fff",
            border: `1px solid ${error ? "var(--color-danger)" : "var(--brand-sage-100)"}`,
            borderRadius: "var(--r-2)",
            letterSpacing: "-0.005em",
            appearance: "none",
            WebkitAppearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            ...style,
          }}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          aria-hidden
          style={{
            position: "absolute",
            right: 10,
            color: "var(--fg-3)",
            pointerEvents: "none",
          }}
        />
      </div>
      {hint && !error && (
        <span id={hintId} style={{ fontSize: 11, color: "var(--fg-3)" }}>
          {hint}
        </span>
      )}
      {error && (
        <span
          id={errId}
          style={{ fontSize: 11, fontWeight: 500, color: "var(--color-danger)" }}
        >
          {error}
        </span>
      )}
    </div>
  );
});

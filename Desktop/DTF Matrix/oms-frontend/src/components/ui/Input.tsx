import { InputHTMLAttributes, forwardRef, ReactNode, useId } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, leftIcon, rightIcon, id, style, containerStyle, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errId = error ? `${inputId}-err` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <label
          htmlFor={inputId}
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
        {leftIcon && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 10,
              display: "inline-flex",
              color: "var(--fg-3)",
              pointerEvents: "none",
            }}
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          style={{
            width: "100%",
            height: 34,
            padding: `0 ${rightIcon ? 32 : 12}px 0 ${leftIcon ? 32 : 12}px`,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--fg-1)",
            background: disabled ? "var(--brand-sage-50)" : "#fff",
            border: `1px solid ${error ? "var(--color-danger)" : "var(--brand-sage-100)"}`,
            borderRadius: "var(--r-2)",
            letterSpacing: "-0.005em",
            ...style,
          }}
          {...rest}
        />
        {rightIcon && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 10,
              display: "inline-flex",
              color: "var(--fg-3)",
              pointerEvents: "none",
            }}
          >
            {rightIcon}
          </span>
        )}
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

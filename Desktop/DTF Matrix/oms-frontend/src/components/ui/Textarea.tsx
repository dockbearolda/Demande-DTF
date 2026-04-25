import { TextareaHTMLAttributes, forwardRef, ReactNode, useId } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, hint, error, id, style, containerStyle, disabled, rows = 4, ...rest },
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
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fg-1)",
          background: disabled ? "var(--brand-sage-50)" : "#fff",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--brand-sage-100)"}`,
          borderRadius: "var(--r-2)",
          letterSpacing: "-0.005em",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.5,
          ...style,
        }}
        {...rest}
      />
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

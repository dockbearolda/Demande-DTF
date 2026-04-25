import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
}

export function Card({
  header,
  footer,
  children,
  padded = true,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      style={{
        background: "var(--brand-paper-hi)",
        border: "1px solid var(--brand-sage-100)",
        borderRadius: "var(--r-3)",
        boxShadow: "var(--shadow-1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      {header && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--brand-sage-100)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--fg-1)",
          }}
        >
          {header}
        </div>
      )}
      <div style={{ padding: padded ? 16 : 0, flex: 1 }}>{children}</div>
      {footer && (
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--brand-sage-100)",
            background: "var(--brand-paper)",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

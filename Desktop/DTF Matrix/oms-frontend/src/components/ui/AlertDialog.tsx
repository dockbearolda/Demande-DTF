import { ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "./Button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  onConfirm: () => void | Promise<void>;
  /**
   * If set, the user must type this string (case-insensitive, trimmed) before
   * the confirm button is enabled. Use for destructive actions on large sets.
   */
  typeToConfirm?: string;
  children?: ReactNode;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  confirmTone = "primary",
  onConfirm,
  typeToConfirm,
  children,
}: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
      return;
    }
    const focusTarget = typeToConfirm ? inputRef.current : confirmBtnRef.current;
    focusTarget?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, typeToConfirm, onOpenChange]);

  if (!open) return null;

  const matches =
    !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();
  const confirmDisabled = !matches || busy;

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      style={{ zIndex: 1100 }}
    >
      <div
        className="olda-scrim absolute inset-0"
        onClick={() => !busy && onOpenChange(false)}
        style={{
          background: "rgba(74,98,116,0.34)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
        }}
      />
      <div
        ref={panelRef}
        className="olda-panel fixed left-1/2 top-1/2"
        style={{
          width: "min(440px, calc(100vw - 32px))",
          background: "rgba(244,244,242,0.98)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderRadius: 14,
          boxShadow:
            "0 32px 80px rgba(32,41,48,0.28), 0 2px 6px rgba(32,41,48,0.08)",
          transform: "translate(-50%, -50%)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2
          id="alert-title"
          style={{ fontSize: 16, fontWeight: 700, color: "var(--fg-1)", margin: 0 }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--fg-2)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
        {children}
        {typeToConfirm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--fg-2)",
              }}
            >
              Tape{" "}
              <span
                style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Mono', ui-monospace, monospace",
                  fontWeight: 700,
                  color: "var(--fg-1)",
                }}
              >
                {typeToConfirm}
              </span>{" "}
              pour confirmer
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches) {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
              style={{
                height: 34,
                padding: "0 12px",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--fg-1)",
                background: "#fff",
                border: "1px solid var(--brand-sage-100)",
                borderRadius: "var(--r-2)",
                letterSpacing: "-0.005em",
              }}
            />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={confirmTone === "danger" ? "danger" : "primary"}
            loading={busy}
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

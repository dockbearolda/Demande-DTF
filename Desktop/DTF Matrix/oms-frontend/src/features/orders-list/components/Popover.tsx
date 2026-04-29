import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
  /** Décalage horizontal en px depuis le bord gauche de l'ancre. */
  offsetX?: number;
  /** Largeur min en px. */
  minWidth?: number;
  align?: "start" | "end";
}

/**
 * Popover positionné sous l'ancre, avec gestion click-outside + Escape.
 * Volontairement minimaliste : pas de portal — on accepte que le parent
 * soit `position: relative` sur la barre de filtres.
 */
export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  offsetX = 0,
  minWidth = 240,
  align = "start",
}: Props) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={popRef}
      role="dialog"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: align === "start" ? offsetX : undefined,
        right: align === "end" ? -offsetX : undefined,
        minWidth,
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(74,98,116,0.14)",
        borderRadius: 10,
        boxShadow:
          "0 12px 40px rgba(32,41,48,0.14), 0 2px 8px rgba(32,41,48,0.06)",
        padding: 8,
        zIndex: 60,
        animation: "olda-pop-in 140ms cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      {children}
      <style>{`
        @keyframes olda-pop-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

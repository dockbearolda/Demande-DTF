import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface DrawerShellProps {
  open: boolean;
  /** Appelé quand l'utilisateur demande la fermeture (croix, Esc, clic backdrop). */
  onRequestClose: () => void;
  /** Libellé accessible du drawer (aria-label). */
  ariaLabel: string;
  children: ReactNode;
  /** Transition en ms (par défaut 220). */
  durationMs?: number;
}

/**
 * Primitive de drawer plein écran, accessible (aria-modal, focus trap, restore focus).
 * Tailwind only, sans dépendance externe. Animation slide-up + fade.
 */
export function DrawerShell({
  open,
  onRequestClose,
  ariaLabel,
  children,
  durationMs = 220,
}: DrawerShellProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Mount / unmount avec délai pour laisser jouer la transition.
  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      // tick suivant : déclenche la transition.
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(id);
  }, [open, durationMs]);

  // Focus initial au mount.
  useEffect(() => {
    if (!visible) return;
    const root = containerRef.current;
    if (!root) return;
    const focusable = root.querySelector<HTMLElement>(
      '[data-autofocus="true"], [autofocus]',
    );
    (focusable ?? root).focus();
  }, [visible]);

  // Restore focus à la fermeture complète.
  useEffect(() => {
    if (mounted) return;
    lastFocusRef.current?.focus?.();
  }, [mounted]);

  // Esc → close.
  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onRequestClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mounted, onRequestClose]);

  // Verrouille le scroll du body pendant l'ouverture.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Focus trap simple (Tab cycle).
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = containerRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) {
      e.preventDefault();
      root.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const portalTarget = useMemo(
    () => (typeof document === "undefined" ? null : document.body),
    [],
  );
  if (!mounted || !portalTarget) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 outline-none"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onRequestClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        style={{
          opacity: visible ? 1 : 0,
          transition: `opacity ${durationMs}ms ease-out`,
        }}
      />
      {/* Panel */}
      <div
        className="absolute inset-0 flex flex-col bg-slate-50 shadow-xl"
        style={{
          transform: visible ? "translateY(0)" : "translateY(2%)",
          opacity: visible ? 1 : 0,
          transition: `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`,
        }}
      >
        {children}
      </div>
    </div>,
    portalTarget,
  );
}

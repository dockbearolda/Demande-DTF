import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastTone = "info" | "error" | "success";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
  action?: ToastAction;
}

interface ShowOptions {
  tone?: ToastTone;
  /** Durée d'affichage en ms (par défaut 4000). */
  duration?: number;
  /** Bouton d'action (typiquement "Annuler" pour les opérations annulables). */
  action?: ToastAction;
}

interface ToastContextValue {
  show: (message: string, opts?: ShowOptions | ToastTone) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, optsOrTone?: ShowOptions | ToastTone): number => {
      const id = Date.now() + Math.random();
      const opts: ShowOptions =
        typeof optsOrTone === "string" ? { tone: optsOrTone } : optsOrTone ?? {};
      const tone = opts.tone ?? "info";
      const duration = opts.duration ?? 4000;
      setItems((prev) => [...prev, { id, message, tone, duration, action: opts.action }]);
      const handle = setTimeout(() => {
        timers.current.delete(id);
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timers.current.set(id, handle);
      return id;
    },
    [],
  );

  // Cleanup tous les timers actifs si le provider unmount (route reload,
  // hot-reload, etc.). Sans ça, les setTimeout rappelleraient `setItems`
  // sur un composant démonté — warning React 17, no-op React 18, mais bug
  // logique potentiel et fuite mémoire des handles.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        style={{ zIndex: 1200 }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            style={{
              background:
                t.tone === "error"
                  ? "var(--color-danger)"
                  : t.tone === "success"
                    ? "var(--status-delivered-bg, #16a34a)"
                    : "var(--fg-1)",
              color: "var(--fg-on-primary)",
              boxShadow: "var(--shadow-2)",
              animation: "olda-toast-in 180ms cubic-bezier(0.32,0.72,0,1)",
            }}
            className="pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "none",
                  color: "var(--fg-on-primary)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
        <style>{`
          @keyframes olda-toast-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

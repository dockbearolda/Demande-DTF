import { useEffect, useState } from "react";
import { useAutoSaveStatus, type AutoSaveState } from "../useAutoSaveDraft";

/** Discreet save-status pill rendered next to the wizard title.
 *
 *  - Saving      → spinner + "Sauvegarde…"
 *  - Saved       → "Sauvegardé · il y a Xs" (live, refreshed every 15s)
 *  - Error       → "Erreur de sauvegarde"
 *  - Offline     → "Hors ligne — sauvegarde locale"
 *  - Idle (initial, before first save) → renders nothing so the header
 *    doesn't show a stale dash for users who just opened the wizard. */
export function SaveStatusIndicator() {
  const state = useAutoSaveStatus((s) => s.state);
  const lastSavedAt = useAutoSaveStatus((s) => s.lastSavedAt);

  // Tick every 15 s to refresh the relative time label without burning
  // re-renders. The label only changes meaningfully on minute boundaries.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state !== "saved" || lastSavedAt === null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [state, lastSavedAt]);

  if (state === "idle" && lastSavedAt === null) return null;

  const { label, tone, withSpinner } = describeStatus(state, lastSavedAt);

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-text)",
        fontSize: 11,
        fontWeight: 500,
        color: tone,
        whiteSpace: "nowrap",
      }}
    >
      {withSpinner && <Spinner />}
      {label}
    </span>
  );
}

function describeStatus(
  state: AutoSaveState,
  lastSavedAt: number | null,
): { label: string; tone: string; withSpinner: boolean } {
  switch (state) {
    case "saving":
      return {
        label: "Sauvegarde…",
        tone: "var(--brand-sage-600, #8a9a8d)",
        withSpinner: true,
      };
    case "saved":
      return {
        label: lastSavedAt
          ? `Sauvegardé · ${formatRelative(lastSavedAt)}`
          : "Sauvegardé",
        tone: "#64748b",
        withSpinner: false,
      };
    case "error":
      return {
        label: "Erreur de sauvegarde",
        tone: "#b45309",
        withSpinner: false,
      };
    case "offline":
      return {
        label: "Hors ligne — sauvegarde locale",
        tone: "#b45309",
        withSpinner: false,
      };
    default:
      return { label: "", tone: "#64748b", withSpinner: false };
  }
}

function formatRelative(ts: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: "save-spin 0.9s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <style>{`@keyframes save-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

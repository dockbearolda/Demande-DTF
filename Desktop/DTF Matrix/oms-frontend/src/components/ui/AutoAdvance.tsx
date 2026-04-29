import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Props {
  /** Quand `active` passe à true, le compte à rebours démarre. */
  active: boolean;
  /** Durée du compte à rebours en ms. Défaut 300. */
  delay?: number;
  /** Callback déclenché à la fin du délai si non annulé. */
  onComplete: () => void;
  /**
   * Clé à changer pour redémarrer un nouveau compte à rebours sur la même
   * sélection (ex. l'utilisateur reclique sur la même carte → re-focus suivante).
   */
  resetKey?: string | number;
  /** Annonce vocale (screen readers). Défaut adapté à 300ms. */
  announcement?: string;
}

/**
 * AutoAdvance — wrapper "passage automatique avec annulation".
 *
 * Affiche une mini-progress bar + un message annonçant le délai.
 * Pendant le décompte, Échap annule (le focus reste sur la sélection).
 *
 * Annonce vocale (`role="status" aria-live="polite"`) destinée aux lecteurs
 * d'écran.
 */
export function AutoAdvance({
  active,
  delay = 300,
  onComplete,
  resetKey,
  announcement,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [cancelled, setCancelled] = useState(false);

  // Reset cancelled + progress chaque fois que `active` ou `resetKey` change
  useEffect(() => {
    setCancelled(false);
    setProgress(0);
  }, [active, resetKey]);

  useEffect(() => {
    if (!active || cancelled) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / delay);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, cancelled, delay, onComplete, resetKey]);

  // Échap annule pendant le décompte
  useKeyboardShortcuts(
    [
      {
        key: "Escape",
        label: "Annuler le passage automatique",
        group: "Auto-avance",
        handler: () => setCancelled(true),
      },
    ],
    { enabled: active && !cancelled && progress < 1 },
  );

  if (!active || cancelled) return null;

  const ariaText =
    announcement ??
    `Sélection passera à l'étape suivante dans ${delay}ms`;

  return (
    <span role="status" aria-live="polite" className="sr-only">
      {ariaText}
    </span>
  );
}

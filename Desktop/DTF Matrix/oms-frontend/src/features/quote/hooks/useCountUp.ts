import { useEffect, useRef, useState } from "react";

/**
 * Tween d'une valeur numérique vers `target` sur `durationMs`. Re-déclenche
 * une transition fluide à chaque changement de cible — l'animation reprend
 * depuis la valeur affichée à ce moment-là (pas depuis l'ancienne cible),
 * ce qui évite tout "saut" si la cible bouge en plein vol.
 *
 * Respecte `prefers-reduced-motion: reduce` en snap-and-set immédiat.
 */
export function useCountUp(target: number, durationMs = 300): number {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);
  const lastDisplayRef = useRef(target);

  // Sync the latest rendered value into a ref so the next tween can pick it
  // up mid-flight without re-running the effect.
  lastDisplayRef.current = display;

  useEffect(() => {
    if (target === lastDisplayRef.current) return;

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || durationMs <= 0) {
      setDisplay(target);
      return;
    }

    const from = lastDisplayRef.current;
    const to = target;
    const startTs = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, durationMs]);

  return display;
}

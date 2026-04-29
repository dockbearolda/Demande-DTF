import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Position absolue dans un parent `relative` (carte sélectionnable). Default: false. */
  corner?: boolean;
  className?: string;
}

/**
 * Badge clavier : touche de raccourci affichée sur une carte/bouton.
 * Style monospace, fond gris pâle, bordure, ombre subtile.
 *
 * Usage :
 *   <button className="relative …"><KbdBadge corner>1</KbdBadge>…</button>
 */
export function KbdBadge({ children, corner = false, className = "" }: Props) {
  const base =
    "inline-flex h-5 min-w-[20px] items-center justify-center rounded-md " +
    "border border-slate-300 bg-slate-50 px-1.5 font-mono text-[11px] " +
    "font-bold leading-none text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.06)] " +
    "tabular-nums";
  const positioned = corner
    ? "absolute right-1.5 top-1.5 pointer-events-none select-none"
    : "";
  return (
    <kbd
      aria-hidden="true"
      className={`${base} ${positioned} ${className}`.trim()}
    >
      {children}
    </kbd>
  );
}

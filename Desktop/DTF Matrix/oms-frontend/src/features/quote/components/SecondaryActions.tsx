import { Printer, X } from "lucide-react";

export interface SecondaryActionsProps {
  onPrint?: () => void;
  onCancel?: () => void;
  /** Désactive l'impression tant que le devis n'est pas imprimable. */
  disablePrint?: boolean;
  className?: string;
}

/**
 * Boutons secondaires du header devis : « Imprimer » et « Annuler ».
 * Style ghost (transparent + border), même hauteur que les chips header.
 */
export function SecondaryActions({
  onPrint,
  onCancel,
  disablePrint,
  className,
}: SecondaryActionsProps) {
  return (
    <div className={`flex items-center gap-s-2 ${className ?? ""}`}>
      <GhostButton
        onClick={onPrint}
        disabled={disablePrint}
        icon={<Printer size={14} strokeWidth={1.75} aria-hidden="true" />}
        label="Imprimer"
      />
      <GhostButton
        onClick={onCancel}
        icon={<X size={14} strokeWidth={1.75} aria-hidden="true" />}
        label="Annuler"
        tone="muted"
      />
    </div>
  );
}

interface GhostButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "muted";
}

function GhostButton({
  onClick,
  disabled,
  icon,
  label,
  tone = "default",
}: GhostButtonProps) {
  const toneClass =
    tone === "muted"
      ? "border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800"
      : "border-ink-200 text-ink-700 hover:border-accent-500 hover:bg-accent-50 hover:text-accent-700";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-s-2 rounded-r-2 border bg-transparent px-s-3 text-[12.5px] font-medium transition-all duration-mid ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-200 disabled:hover:bg-transparent ${toneClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

import { memo } from "react";

// ───────── PillButton ─────────

interface PillButtonProps {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dashed?: boolean;
  size?: "sm" | "md";
  danger?: boolean;
}

export const PillButton = memo(function PillButton({
  selected,
  onClick,
  children,
  dashed = false,
  size = "md",
  danger = false,
}: PillButtonProps) {
  const sizeCls = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1";

  if (dashed) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${sizeCls} border border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700`}
      >
        {children}
      </button>
    );
  }

  const cls = selected
    ? danger
      ? "bg-rose-600 text-white shadow-sm ring-1 ring-rose-700/20"
      : "bg-slate-800 text-white shadow-sm ring-1 ring-slate-900/10"
    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      onClick={onClick}
      className={`${base} ${sizeCls} ${cls}`}
    >
      {children}
    </button>
  );
});

// ───────── Section ─────────

interface SectionProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function Section({ label, required, error, hint, children }: SectionProps) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
        {hint && !error && (
          <span className="text-[10px] text-slate-400">· {hint}</span>
        )}
        {error && (
          <span className="text-[10px] font-medium text-rose-500">· {error}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ───────── Input ─────────

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "numeric" | "text";
  autoFocus?: boolean;
  invalid?: boolean;
}

export function Input({
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus,
  invalid,
}: InputProps) {
  return (
    <input
      type="text"
      value={value}
      autoFocus={autoFocus}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      className={`block h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
        invalid
          ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
          : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"
      }`}
    />
  );
}

// ───────── QtyCell (pour grille textile) ─────────

interface QtyCellProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  compact?: boolean;
}

export function QtyCell({ value, onChange, label, compact }: QtyCellProps) {
  const h = compact ? "h-10" : "h-12";
  return (
    <div className={`relative ${h} overflow-hidden rounded-md border ${
      value > 0 ? "border-slate-800 bg-slate-800" : "border-slate-200 bg-white"
    } transition-colors`}>
      <input
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        placeholder={label ?? "0"}
        className={`h-full w-full bg-transparent text-center text-sm font-semibold tabular-nums focus:outline-none ${
          value > 0
            ? "text-white placeholder:text-white/40"
            : "text-slate-800 placeholder:text-slate-300"
        }`}
      />
    </div>
  );
}

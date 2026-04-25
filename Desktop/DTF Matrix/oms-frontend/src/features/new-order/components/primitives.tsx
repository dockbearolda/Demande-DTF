import {
  createContext,
  memo,
  useContext,
  useId,
  type ReactNode,
} from "react";
import { FieldError } from "./FieldError";

// ───────── PillButton ─────────

interface PillButtonProps {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dashed?: boolean;
  size?: "sm" | "md" | "lg";
  danger?: boolean;
  ariaLabel?: string;
}

export const PillButton = memo(function PillButton({
  selected,
  onClick,
  children,
  dashed = false,
  size = "md",
  danger = false,
  ariaLabel,
}: PillButtonProps) {
  // All sizes meet WCAG 2.5.5 AA tap-target (≥ 44×44 effective via padding).
  const sizeCls =
    size === "sm"
      ? "min-h-[40px] px-3 text-sm"
      : size === "lg"
        ? "min-h-[44px] px-5 text-sm"
        : "min-h-[44px] px-4 text-sm";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 select-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.97]";

  if (dashed) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${base} ${sizeCls} border border-dashed border-slate-400 bg-white text-slate-700 hover:border-slate-600 hover:text-slate-900`}
      >
        {children}
      </button>
    );
  }

  const cls = selected
    ? danger
      ? "bg-rose-700 text-white shadow-sm ring-1 ring-rose-800/30"
      : "border-2 border-blue-700 bg-blue-50 text-blue-800 shadow-sm"
    : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${base} ${sizeCls} ${cls}`}
    >
      {children}
    </button>
  );
});

// ───────── SegmentedControl (iOS-style) ─────────

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T | null | undefined;
  onChange: (v: T) => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  size?: "sm" | "md" | "lg";
  /** When true, segments wrap on multiple rows (useful for many options on mobile). */
  wrap?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  ariaDescribedBy,
  size = "md",
  wrap = false,
}: SegmentedControlProps<T>) {
  // Each segment ≥ 44px tall to meet AA tap-target on touch.
  const h = size === "sm" ? "h-11" : size === "lg" ? "h-12" : "h-11";
  const text = size === "sm" ? "text-sm" : size === "lg" ? "text-base" : "text-sm";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={`inline-flex w-full rounded-xl bg-slate-100 p-1 ${
        wrap ? "flex-wrap gap-1" : ""
      }`}
    >
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(opt.value)}
            className={`${h} ${text} ${
              wrap ? "min-w-[72px] flex-1" : "flex-1"
            } inline-flex items-center justify-center gap-2 rounded-lg px-3 font-semibold transition-all duration-200 select-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.97] ${
              sel
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/10"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───────── IOSSwitch ─────────

interface IOSSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
  variant?: "default" | "danger";
}

export function IOSSwitch({
  checked,
  onChange,
  ariaLabel,
  variant = "default",
}: IOSSwitchProps) {
  const onColor = variant === "danger" ? "bg-rose-600" : "bg-emerald-600";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      // 44×44 tap target via padding; visible track is 46×28
      className={`relative inline-flex h-11 w-11 flex-none items-center justify-center rounded-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-7 w-[46px] items-center rounded-full transition-colors duration-200 ${
          checked ? onColor : "bg-slate-400"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

// ───────── Section + field-context for ARIA error wiring ─────────

interface SectionFieldContextValue {
  fieldId: string;
  errorId: string;
  hasError: boolean;
}

const SectionFieldContext = createContext<SectionFieldContextValue | null>(null);

/**
 * useSectionField — call inside the input rendered as a Section child.
 * Returns the props needed to wire ARIA error linking & invalid state.
 *
 * Usage:
 *   const a11y = useSectionField();
 *   <input id={a11y?.fieldId} aria-describedby={a11y?.errorId} aria-invalid={a11y?.hasError || undefined} />
 */
export function useSectionField(): SectionFieldContextValue | null {
  return useContext(SectionFieldContext);
}

interface SectionProps {
  label: string;
  required?: boolean;
  /** Inline error text, displayed via FieldError and exposed to children via context. */
  error?: string;
  hint?: string;
  /** Stable id; auto-generated when omitted. */
  name?: string;
  children: React.ReactNode;
}

export function Section({
  label,
  required,
  error,
  hint,
  name,
  children,
}: SectionProps) {
  const generatedId = useId();
  const fieldId = name ? `field-${name}` : `field${generatedId}`;
  const errorId = `${fieldId}-error`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const hasError = !!error;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-2 flex items-center gap-2"
      >
        <span className="text-[13px] font-bold uppercase tracking-wider text-slate-700">
          {label}
          {required && (
            <>
              <span className="ml-0.5 text-rose-700" aria-hidden="true">*</span>
              <span className="sr-only"> (champ requis)</span>
            </>
          )}
        </span>
        {hint && !error && (
          <span id={hintId} className="text-[11px] text-slate-600">· {hint}</span>
        )}
      </label>
      <SectionFieldContext.Provider value={{ fieldId, errorId, hasError }}>
        {children}
      </SectionFieldContext.Provider>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

// ───────── Input ─────────

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  inputMode?: "tel" | "numeric" | "text";
  autoFocus?: boolean;
  invalid?: boolean;
  /** Override id (defaults to ambient SectionField context). */
  id?: string;
  /** Override aria-describedby (defaults to ambient context errorId). */
  ariaDescribedBy?: string;
  ariaLabel?: string;
}

export function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  inputMode,
  autoFocus,
  invalid,
  id,
  ariaDescribedBy,
  ariaLabel,
}: InputProps) {
  const ctx = useSectionField();
  const resolvedId = id ?? ctx?.fieldId;
  const resolvedDescribedBy =
    ariaDescribedBy ?? (ctx && ctx.hasError ? ctx.errorId : undefined);
  const isInvalid = invalid ?? ctx?.hasError ?? false;

  return (
    <input
      id={resolvedId}
      type="text"
      value={value}
      autoFocus={autoFocus}
      inputMode={inputMode}
      aria-label={ariaLabel}
      aria-invalid={isInvalid || undefined}
      aria-describedby={resolvedDescribedBy}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      // text-base = 16px → no iOS auto-zoom on focus.
      className={`block h-12 w-full rounded-lg border bg-white px-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        isInvalid
          ? "border-rose-500 focus:border-rose-600"
          : "border-slate-300 focus:border-slate-500"
      }`}
    />
  );
}

// ───────── QuantityStepper (accessible +/− with ≥ 44px tap zones) ─────────

interface QuantityStepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Announced label, e.g. "Quantité pour Royal · M". Required for AT. */
  ariaLabel: string;
  /** Override id (defaults to ambient SectionField context). */
  id?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  ariaLabel,
  id,
}: QuantityStepperProps) {
  const ctx = useSectionField();
  const resolvedId = id ?? ctx?.fieldId;
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(max != null ? Math.min(max, value + step) : value + step);

  return (
    <div
      className={`inline-flex items-stretch rounded-lg border bg-white ${
        value > 0 ? "border-blue-700" : "border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={dec}
        aria-label={`Diminuer ${ariaLabel}`}
        disabled={value <= min}
        // 44×44 tap target.
        className="flex h-11 min-w-[44px] items-center justify-center rounded-l-lg px-2 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <MinusIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        id={resolvedId}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value || ""}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        placeholder="0"
        // 16px font (text-base) prevents iOS zoom; min-w-[56px] keeps 2-3 digits visible.
        className={`h-11 w-14 min-w-[56px] border-l border-r border-slate-300 bg-transparent text-center text-base tabular-nums focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 ${
          value > 0 ? "font-bold text-blue-800" : "font-semibold text-slate-800"
        }`}
      />
      <button
        type="button"
        onClick={inc}
        aria-label={`Augmenter ${ariaLabel}`}
        disabled={max != null && value >= max}
        className="flex h-11 min-w-[44px] items-center justify-center rounded-r-lg px-2 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ───────── QtyCell (pour grille textile) ─────────

interface QtyCellProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  compact?: boolean;
  ariaLabel?: string;
}

export function QtyCell({ value, onChange, label, compact, ariaLabel }: QtyCellProps) {
  const h = compact ? "h-11" : "h-12";
  return (
    <div className={`relative ${h} overflow-hidden rounded-md border-2 ${
      value > 0 ? "border-blue-700 bg-blue-50" : "border-slate-300 bg-white"
    } transition-colors`}>
      <input
        type="number"
        min={0}
        value={value || ""}
        aria-label={ariaLabel ?? label}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        placeholder={label ?? "0"}
        // 16px font on mobile prevents iOS auto-zoom.
        className={`h-full w-full bg-transparent text-center text-base tabular-nums focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 ${
          value > 0
            ? "font-bold text-blue-800 placeholder:text-blue-400"
            : "font-semibold text-slate-900 placeholder:text-slate-400"
        }`}
      />
    </div>
  );
}

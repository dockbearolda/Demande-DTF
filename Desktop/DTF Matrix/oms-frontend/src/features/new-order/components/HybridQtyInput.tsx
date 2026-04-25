import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  presets?: number[];
  autoFocus?: boolean;
  invalid?: boolean;
}

/**
 * Saisie quantité hybride : taper au clavier OU cliquer un preset.
 * Le popover s'ouvre au focus/click et se ferme au choix ou clic extérieur.
 */
export function HybridQtyInput({
  value,
  onChange,
  presets = [10, 20, 50, 100],
  autoFocus,
  invalid,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const filled = value > 0;

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex h-11 items-stretch overflow-hidden rounded-lg border transition ${
          invalid
            ? "border-rose-400 ring-2 ring-rose-100"
            : filled
              ? "border-slate-800 bg-slate-800"
              : open
                ? "border-slate-400 ring-2 ring-slate-100 bg-white"
                : "border-slate-200 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus={autoFocus}
          value={value || ""}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
            }
          }}
          placeholder="Qté"
          className={`h-full w-full min-w-0 bg-transparent px-3 text-center text-base font-semibold tabular-nums focus:outline-none ${
            filled
              ? "text-white placeholder:text-white/40"
              : "text-slate-800 placeholder:text-slate-300"
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className={`flex w-8 flex-none items-center justify-center border-l transition ${
            filled
              ? "border-white/20 text-white/70 hover:text-white"
              : "border-slate-200 text-slate-400 hover:text-slate-700"
          }`}
          aria-label="Quantités rapides"
        >
          <Chevron open={open} />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Quantités rapides"
          className="absolute left-0 right-0 top-full z-30 mt-2 min-w-[180px] origin-top overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Quantités rapides
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-2 pt-1">
            {presets.map((p) => {
              const active = p === value;
              return (
                <button
                  key={p}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className={`h-10 rounded-lg text-sm font-semibold tabular-nums transition ${
                    active
                      ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-900/10"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
            Ou tapez une valeur personnalisée
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

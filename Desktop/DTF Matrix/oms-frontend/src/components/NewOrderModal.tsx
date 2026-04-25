import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useClients } from "@/hooks/useClients";
import { useCreateOrder } from "@/hooks/useOrders";
import { useSearchOrCreateClient } from "@/hooks/useCreateClientOrSearch";
import { useToast } from "@/components/Toast";
import { formatPhoneNumber, generateReference } from "@/lib/utils";
import type { Client } from "@/lib/types";

/* =========================================================================
   Constants
   ========================================================================= */

const OPERATORS: {
  value: "L" | "C" | "M";
  initial: string;
  name: string;
  gradient: string;
}[] = [
  {
    value: "L",
    initial: "L",
    name: "Loïc",
    gradient: "linear-gradient(135deg, #4A6274 0%, #6B8191 100%)",
  },
  {
    value: "C",
    initial: "C",
    name: "Charlie",
    gradient: "linear-gradient(135deg, #556876 0%, #4A6274 100%)",
  },
  {
    value: "M",
    initial: "M",
    name: "Mélina",
    gradient: "linear-gradient(135deg, #6B8191 0%, #556876 100%)",
  },
];

const PRODUCT_CATALOG = [
  "Textiles",
  "T-Shirt",
  "Polo",
  "Sweat-shirt",
  "Veste",
  "Casquette",
  "Tote Bag",
  "Porte-Clés",
  "Mug",
  "Sticker",
  "Badge",
  "Carnet",
  "Stylo",
];

const SECTEURS = ["DTF", "PRESSAGE", "UV", "TROTEC", "GOODIES", "AUTRES"] as const;
const SECTEUR_LABELS: Record<(typeof SECTEURS)[number], string> = {
  DTF: "DTF",
  PRESSAGE: "Pressage",
  UV: "UV",
  TROTEC: "Trotec",
  GOODIES: "Goodies",
  AUTRES: "Autres",
};

const DRAFT_KEY = "newOrderDraft";

/* =========================================================================
   Types
   ========================================================================= */

export interface NewOrderLine {
  secteur: string;
  produit: string;
  quantite: number;
  notes: string;
}

export interface NewOrderDraft {
  clientNom: string;
  clientId: string;
  personneContact: string;
  telephone: string;
  assignedTo: "" | "L" | "C" | "M";
  dateLivraison: string;
  isUrgent: boolean;
  notesGlobales: string;
  lines: NewOrderLine[];
}

const EMPTY_DRAFT: NewOrderDraft = {
  clientNom: "",
  clientId: "",
  personneContact: "",
  telephone: "",
  assignedTo: "",
  dateLivraison: "",
  isUrgent: false,
  notesGlobales: "",
  lines: [],
};

function emptyLine(): NewOrderLine {
  return { secteur: "", produit: "", quantite: 0, notes: "" };
}

/* =========================================================================
   Tiny inline icons (stroke currentColor)
   ========================================================================= */

function Icon({
  d,
  size = 14,
  className,
  fill = "none",
}: {
  d: string;
  size?: number;
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const IC_X = "M18 6 6 18M6 6l12 12";
const IC_CAL =
  "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z";
const IC_FLAME =
  "M12 2s4 4 4 8a4 4 0 1 1-8 0c0-1.5.5-2.5 1-3.5C10 4 12 2 12 2zM6 14c0 4 3 7 6 7s6-3 6-7";
const IC_TRASH =
  "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z";
const IC_PLUS = "M12 5v14M5 12h14";
const IC_LOADER = "M21 12a9 9 0 1 1-6.219-8.56";

/* =========================================================================
   Hotkeys hook
   ========================================================================= */

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const needMeta = parts.includes("mod");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");
  const modOk = needMeta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
  const shiftOk = needShift ? e.shiftKey : !e.shiftKey;
  const altOk = needAlt ? e.altKey : !e.altKey;
  const k = (e.key || "").toLowerCase();
  const keyOk = k === key || (key === "enter" && k === "enter");
  return modOk && shiftOk && altOk && keyOk;
}

function useHotkeys(map: HotkeyMap, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      for (const combo of Object.keys(map)) {
        if (matchCombo(e, combo)) {
          map[combo](e);
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, enabled]);
}

/* =========================================================================
   Focus trap
   ========================================================================= */

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    function handler(e: KeyboardEvent) {
      if (e.key !== "Tab" || !el) return;
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(
        (n) => !n.hasAttribute("disabled") && n.offsetParent !== null
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    el.addEventListener("keydown", handler as unknown as EventListener);
    return () =>
      el.removeEventListener("keydown", handler as unknown as EventListener);
  }, [active, containerRef]);
}

/* =========================================================================
   ClientCombobox
   ========================================================================= */

interface ClientComboboxProps {
  value: string;
  onInput: (value: string) => void;
  onSelect: (client: Client) => void;
  clients: Client[];
  invalid?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

function fuzzyMatchClient(c: Client, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return (
    c.nom.toLowerCase().includes(needle) ||
    (c.telephone ?? "").toLowerCase().includes(needle) ||
    (c.email ?? "").toLowerCase().includes(needle)
  );
}

function ClientCombobox({
  value,
  onInput,
  onSelect,
  clients,
  invalid,
  inputRef,
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const localRef = useRef<HTMLInputElement | null>(null);
  const ref = inputRef ?? localRef;

  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    return clients.filter((c) => fuzzyMatchClient(c, value)).slice(0, 6);
  }, [value, clients]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelect(suggestions[highlight]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => {
          onInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Commencer à taper…"
        aria-label="Nom du client"
        aria-invalid={invalid || undefined}
        aria-autocomplete="list"
        className="block h-9 w-full rounded-[8px] border bg-white px-3 text-[13px] text-[color:var(--fg-1)] placeholder:text-[color:var(--fg-4)] transition-colors"
        style={{
          borderColor: invalid
            ? "var(--color-danger)"
            : "var(--brand-sage-100)",
          boxShadow: invalid
            ? "0 0 0 3px rgba(220,38,38,0.12)"
            : undefined,
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-[10px] border bg-white py-1 shadow-lg"
          style={{
            borderColor: "var(--brand-sage-100)",
            boxShadow:
              "0 12px 32px rgba(32,41,48,0.12), 0 2px 4px rgba(32,41,48,0.06)",
          }}
        >
          {suggestions.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(c);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(i)}
              className="cursor-pointer px-3 py-1.5 text-[13px]"
              style={{
                background:
                  i === highlight ? "rgba(107,129,145,0.08)" : "transparent",
                color: "var(--fg-1)",
              }}
            >
              <div className="font-medium">{c.nom}</div>
              {(c.telephone || c.email) && (
                <div
                  className="text-[11px]"
                  style={{ color: "var(--fg-3)" }}
                >
                  {c.telephone ?? c.email}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =========================================================================
   ProductCombobox (per-line)
   ========================================================================= */

function ProductCombobox({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return PRODUCT_CATALOG.slice(0, 6);
    return PRODUCT_CATALOG.filter((p) => p.toLowerCase().includes(q)).slice(
      0,
      6
    );
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) {
            if (e.key === "Enter" && onEnter) onEnter();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight(
              (h) => (h - 1 + suggestions.length) % suggestions.length
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            onChange(suggestions[highlight]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Produit"
        className="h-[30px] w-full rounded-[6px] border border-transparent bg-transparent px-2 text-[13px] text-[color:var(--fg-1)] placeholder:text-[color:var(--fg-4)] focus:bg-white"
        style={{
          transition: "background 140ms, border-color 140ms, box-shadow 140ms",
        }}
        onMouseOver={(e) => {
          if (document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = "var(--brand-sage-100)";
        }}
        onMouseOut={(e) => {
          if (document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = "transparent";
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--brand-duck-300)";
          e.currentTarget.style.boxShadow =
            "0 0 0 2px rgba(107,129,145,0.16)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          e.currentTarget.style.boxShadow = "";
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-auto rounded-[8px] border bg-white py-1 shadow-md"
          style={{ borderColor: "var(--brand-sage-100)" }}
        >
          {suggestions.map((p, i) => (
            <li
              key={p}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(i)}
              className="cursor-pointer px-2.5 py-1 text-[12.5px]"
              style={{
                background:
                  i === highlight ? "rgba(107,129,145,0.08)" : "transparent",
                color: "var(--fg-1)",
              }}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =========================================================================
   OperatorPicker (3 avatar chips)
   ========================================================================= */

function OperatorPicker({
  value,
  onChange,
}: {
  value: "" | "L" | "C" | "M";
  onChange: (value: "L" | "C" | "M") => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Assigné à"
      className="inline-flex h-10 w-full rounded-[10px] p-1"
      style={{ background: "rgba(107,129,145,0.10)" }}
    >
      {OPERATORS.map((op) => {
        const selected = value === op.value;
        return (
          <button
            key={op.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(op.value)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 text-[12.5px] transition-all duration-200 active:scale-[0.97]"
            style={{
              background: selected ? "white" : "transparent",
              boxShadow: selected ? "0 1px 2px rgba(32,41,48,0.08)" : "none",
              color: selected ? "var(--fg-1)" : "var(--fg-3)",
              fontWeight: selected ? 600 : 500,
            }}
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: op.gradient }}
            >
              {op.initial}
            </span>
            <span className="truncate">{op.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   DateShortcuts (Apple-style chips for quick delivery dates)
   ========================================================================= */

const DATE_SHORTCUTS: { label: string; days: number; danger?: boolean }[] = [
  { label: "Demain", days: 1, danger: true },
  { label: "+3j", days: 3 },
  { label: "+5j", days: 5 },
  { label: "+7j", days: 7 },
  { label: "+15j", days: 15 },
];

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function DateShortcuts({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const today = new Date();
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {DATE_SHORTCUTS.map((s) => {
        const target = addDaysIso(today, s.days);
        const sel = value === target;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => onChange(sel ? "" : target)}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold transition-all duration-150 active:scale-[0.96]"
            style={{
              background: sel
                ? s.danger
                  ? "var(--color-urgent)"
                  : "var(--brand-duck-500)"
                : s.danger
                  ? "var(--color-urgent-soft)"
                  : "rgba(107,129,145,0.10)",
              color: sel
                ? "white"
                : s.danger
                  ? "var(--color-urgent-ink)"
                  : "var(--fg-2)",
            }}
          >
            {s.danger && (
              <span
                aria-hidden="true"
                className="block h-1.5 w-1.5 rounded-full"
                style={{
                  background: sel ? "white" : "var(--color-urgent)",
                }}
              />
            )}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   UrgentToggle
   ========================================================================= */

function UrgentToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-[8px] border px-3 text-[12.5px] transition-colors select-none"
      style={{
        background: on ? "var(--color-urgent-soft)" : "white",
        borderColor: on ? "var(--color-urgent)" : "var(--brand-sage-100)",
        color: on ? "var(--color-urgent-ink)" : "var(--fg-2)",
        fontWeight: on ? 600 : 500,
      }}
    >
      <Icon d={IC_FLAME} size={14} />
      <span>Urgent</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Marquer comme urgent"
        onClick={() => onChange(!on)}
        className="relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full transition-colors duration-200"
        style={{
          background: on ? "var(--color-urgent)" : "rgba(74,98,116,0.22)",
        }}
      >
        <span
          className="inline-block h-[18px] w-[18px] transform rounded-full bg-white transition-transform duration-200"
          style={{
            transform: on ? "translateX(18px)" : "translateX(2px)",
            boxShadow: "0 1px 3px rgba(32,41,48,0.18)",
          }}
        />
      </button>
    </label>
  );
}

/* =========================================================================
   LineItemsEditor
   ========================================================================= */

function LineItemsEditor({
  items,
  onChange,
  addLineRef,
}: {
  items: NewOrderLine[];
  onChange: (next: NewOrderLine[]) => void;
  addLineRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);

  const add = useCallback(() => {
    const next = [...items, emptyLine()];
    onChange(next);
    requestAnimationFrame(() => {
      const el = qtyRefs.current[next.length - 1];
      el?.focus();
      el?.select();
    });
  }, [items, onChange]);

  useEffect(() => {
    if (addLineRef) addLineRef.current = add;
  }, [add, addLineRef]);

  function update(i: number, patch: Partial<NewOrderLine>) {
    onChange(items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  const totalQty = items.reduce((s, l) => s + (Number(l.quantite) || 0), 0);

  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{ borderColor: "var(--brand-sage-100)" }}
    >
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr style={{ background: "var(--brand-paper-hi)" }}>
            <th
              className="w-14 border-b px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-3)",
              }}
            >
              Qté
            </th>
            <th
              className="w-28 border-b px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-3)",
              }}
            >
              Secteur
            </th>
            <th
              className="border-b px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-3)",
              }}
            >
              Produit
            </th>
            <th
              className="border-b px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-3)",
              }}
            >
              Note
            </th>
            <th
              className="w-7 border-b px-2 py-2"
              style={{
                borderColor: "var(--brand-sage-100)",
              }}
              aria-label=""
            />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-2.5 py-6 text-center text-[12px]"
                style={{ color: "var(--fg-4)" }}
              >
                Aucune ligne. Ajoute au moins un produit.
              </td>
            </tr>
          )}
          {items.map((l, i) => (
            <tr
              key={i}
              className="border-t"
              style={{ borderColor: "var(--brand-sage-100)" }}
            >
              <td className="px-2 py-1">
                <input
                  ref={(el) => (qtyRefs.current[i] = el)}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={l.quantite || ""}
                  onChange={(e) =>
                    update(i, { quantite: Number(e.target.value) || 0 })
                  }
                  className="h-[30px] w-full rounded-[6px] border border-transparent bg-transparent px-2 text-right text-[13px] tabular-nums text-[color:var(--fg-1)] focus:bg-white"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--brand-duck-300)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px rgba(107,129,145,0.16)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.boxShadow = "";
                  }}
                />
              </td>
              <td className="px-2 py-1">
                <select
                  value={l.secteur}
                  onChange={(e) => update(i, { secteur: e.target.value })}
                  className="h-[30px] w-full rounded-[6px] border border-transparent bg-transparent px-1.5 text-[12.5px] text-[color:var(--fg-1)] focus:bg-white"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--brand-duck-300)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px rgba(107,129,145,0.16)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <option value="">—</option>
                  {SECTEURS.map((s) => (
                    <option key={s} value={s}>
                      {SECTEUR_LABELS[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1">
                <ProductCombobox
                  value={l.produit}
                  onChange={(v) => update(i, { produit: v })}
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="text"
                  value={l.notes}
                  onChange={(e) => update(i, { notes: e.target.value })}
                  placeholder="Optionnel"
                  className="h-[30px] w-full rounded-[6px] border border-transparent bg-transparent px-2 text-[12.5px] text-[color:var(--fg-1)] placeholder:text-[color:var(--fg-4)] focus:bg-white"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--brand-duck-300)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 2px rgba(107,129,145,0.16)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.boxShadow = "";
                  }}
                />
              </td>
              <td className="px-1 py-1">
                <button
                  type="button"
                  aria-label={`Supprimer ligne ${i + 1}`}
                  onClick={() => remove(i)}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                  style={{ color: "var(--fg-4)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(220,38,38,0.08)";
                    e.currentTarget.style.color = "var(--color-danger)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--fg-4)";
                  }}
                >
                  <Icon d={IC_TRASH} size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className="flex items-center justify-between border-t px-2.5 py-2"
        style={{
          background: "var(--brand-paper-hi)",
          borderColor: "var(--brand-sage-100)",
        }}
      >
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-[6px] px-2 py-1 text-[12.5px] font-medium"
          style={{ color: "var(--brand-duck-500)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(107,129,145,0.08)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <Icon d={IC_PLUS} size={13} />
          <span>Ajouter une ligne</span>
          <span className="ml-1 inline-flex items-center gap-0.5">
            <kbd className="olda-kbd">⌘</kbd>
            <kbd className="olda-kbd">⇧</kbd>
            <kbd className="olda-kbd">L</kbd>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--fg-3)" }}
          >
            Total qté
          </span>
          <span
            className="font-mono text-[13px] font-bold tabular-nums"
            style={{ color: "var(--fg-1)" }}
          >
            {totalQty}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Confirm-discard dialog
   ========================================================================= */

function ConfirmDiscard({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex items-center justify-center"
    >
      <div
        className="absolute inset-0"
        onClick={onCancel}
        style={{ background: "rgba(32,41,48,0.4)" }}
      />
      <div
        className="relative w-[380px] rounded-[12px] bg-white p-5 shadow-2xl"
        style={{
          boxShadow: "0 24px 64px rgba(32,41,48,0.28)",
        }}
      >
        <h3
          className="text-[14px] font-semibold"
          style={{ color: "var(--fg-1)" }}
        >
          Abandonner les modifications&nbsp;?
        </h3>
        <p
          className="mt-1 text-[12px]"
          style={{ color: "var(--fg-3)" }}
        >
          Le brouillon sera conservé localement, mais la fenêtre sera fermée.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-[8px] px-3 text-[12.5px]"
            style={{ color: "var(--fg-3)" }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 rounded-[8px] px-3 text-[12.5px] font-semibold text-white"
            style={{ background: "var(--color-danger)" }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =========================================================================
   NewOrderModal
   ========================================================================= */

export interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (draft: NewOrderDraft) => void;
}

export function NewOrderModal({
  open,
  onOpenChange,
  onSubmit,
}: NewOrderModalProps) {
  const { data: clients = [] } = useClients();
  const createOrder = useCreateOrder();
  const searchClient = useSearchOrCreateClient();
  const toast = useToast();

  const [draft, setDraft] = useState<NewOrderDraft>(EMPTY_DRAFT);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientInvalid, setClientInvalid] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [draftRecoveredAt, setDraftRecoveredAt] = useState<number | null>(null);
  const [overwritePhone, setOverwritePhone] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const nomInputRef = useRef<HTMLInputElement>(null);
  const addLineRef = useRef<(() => void) | null>(null);
  const clientFieldRef = useRef<HTMLDivElement>(null);

  /* ---------------- draft persistence ---------------- */

  // load draft on open
  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setClientInvalid(false);
    setOverwritePhone(false);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NewOrderDraft;
        if (
          parsed &&
          (parsed.clientNom ||
            parsed.lines?.length ||
            parsed.notesGlobales ||
            parsed.telephone ||
            parsed.personneContact ||
            parsed.assignedTo)
        ) {
          setDraft({ ...EMPTY_DRAFT, ...parsed });
          setDirty(true);
          setDraftRecoveredAt(Date.now());
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setDraft(EMPTY_DRAFT);
    setDirty(false);
    setDraftRecoveredAt(null);
  }, [open]);

  // debounced save
  useEffect(() => {
    if (!open || !dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, dirty, open]);

  // focus initial
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      nomInputRef.current?.focus();
    }, 40);
    return () => clearTimeout(id);
  }, [open]);

  // prevent body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useFocusTrap(panelRef, open);

  /* ---------------- validation ---------------- */

  const validLines = draft.lines.filter(
    (l) => l.quantite > 0 && l.produit.trim().length > 0 && l.secteur.trim().length > 0
  );
  const canSubmit =
    draft.clientNom.trim().length > 0 && validLines.length > 0 && !submitting;

  const matchedClient = useMemo(() => {
    const q = draft.clientNom.trim().toLowerCase();
    if (!q) return null;
    return clients.find((c) => c.nom.toLowerCase() === q) ?? null;
  }, [draft.clientNom, clients]);

  const isNewClient =
    draft.clientNom.trim().length >= 2 && !matchedClient;

  const phoneConflict =
    matchedClient &&
    draft.telephone.trim() &&
    matchedClient.telephone &&
    matchedClient.telephone.replace(/\s/g, "") !==
      draft.telephone.replace(/\s/g, "");

  /* ---------------- handlers ---------------- */

  const patch = useCallback((p: Partial<NewOrderDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  }, []);

  function requestClose() {
    if (submitting) return;
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  }

  function discardAndClose() {
    setConfirmDiscard(false);
    onOpenChange(false);
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraft(EMPTY_DRAFT);
    setDirty(false);
    setDraftRecoveredAt(null);
  }

  async function submit() {
    if (!draft.clientNom.trim()) {
      setClientInvalid(true);
      setTimeout(() => setClientInvalid(false), 260);
      clientFieldRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      nomInputRef.current?.focus();
      return;
    }
    if (validLines.length === 0) return;
    setSubmitting(true);
    try {
      const clientRes = await searchClient.mutateAsync(draft.clientNom.trim());
      const payload = {
        client_id: clientRes.id,
        reference: generateReference(),
        assigned_to: draft.assignedTo || null,
        personne_contact: draft.personneContact.trim() || null,
        telephone:
          draft.telephone.trim() && (!phoneConflict || overwritePhone)
            ? draft.telephone.trim()
            : phoneConflict
              ? null
              : draft.telephone.trim() || null,
        date_livraison_prevue: draft.dateLivraison || null,
        is_urgent: draft.isUrgent,
        notes_globales: draft.notesGlobales.trim() || null,
        lines: validLines.map((l, idx) => ({
          ligne_numero: idx + 1,
          secteur: l.secteur,
          produit: l.produit.trim(),
          quantite: l.quantite,
          notes: l.notes.trim() || null,
        })),
      };
      const created = await createOrder.mutateAsync(payload);
      onSubmit?.(draft);
      clearDraft();
      toast.show(`Commande ${created.reference} créée`, "info");
      setTimeout(() => {
        onOpenChange(false);
      }, 120);
    } catch (err) {
      console.error(err);
      toast.show("Impossible d'enregistrer. Réessayer.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- hotkeys ---------------- */

  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      escape: () => requestClose(),
      "mod+enter": (e) => {
        e.preventDefault();
        if (canSubmit) submit();
      },
      "mod+shift+l": (e) => {
        e.preventDefault();
        addLineRef.current?.();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canSubmit, dirty, submitting, draft]
  );
  useHotkeys(hotkeys, open);

  if (!open) return null;

  /* ---------------- render ---------------- */

  const viewportWide =
    typeof window !== "undefined" && window.innerWidth >= 1600;
  const panelWidth = viewportWide ? 860 : 780;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-order-title"
    >
      {/* Scrim */}
      <div
        className="olda-scrim absolute inset-0"
        style={{
          background: "rgba(74,98,116,0.34)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
        }}
        onClick={requestClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="olda-panel fixed left-1/2 top-1/2 flex flex-col"
        style={{
          width: panelWidth,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "min(760px, 86vh)",
          background: "rgba(244,244,242,0.98)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderRadius: 14,
          boxShadow:
            "0 32px 80px rgba(32,41,48,0.28), 0 2px 6px rgba(32,41,48,0.08)",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between border-b"
          style={{
            padding: "18px 24px 14px",
            borderColor: "rgba(74,98,116,0.1)",
          }}
        >
          <div>
            <h2
              id="new-order-title"
              className="text-[15px] font-bold"
              style={{ color: "var(--fg-1)" }}
            >
              Nouvelle commande
            </h2>
            <p
              className="mt-0.5 text-[11px] font-medium"
              style={{ color: "var(--fg-3)" }}
            >
              Tous les champs marqués * sont requis
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={requestClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border bg-white"
            style={{
              borderColor: "var(--brand-sage-100)",
              color: "var(--fg-3)",
            }}
          >
            <Icon d={IC_X} size={14} />
          </button>
        </div>

        {/* Draft recovered banner */}
        {draftRecoveredAt && (
          <div
            className="flex items-center justify-between border-b px-6 py-2"
            style={{
              borderColor: "rgba(74,98,116,0.08)",
              background: "rgba(107,129,145,0.06)",
            }}
          >
            <span className="text-[11.5px]" style={{ color: "var(--fg-3)" }}>
              Brouillon récupéré
            </span>
            <button
              type="button"
              onClick={clearDraft}
              className="text-[11.5px] font-semibold"
              style={{ color: "var(--brand-duck-500)" }}
            >
              Effacer
            </button>
          </div>
        )}

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: "22px 24px" }}
        >
          <div className="space-y-4">

            {/* Step 1 — Nom du client */}
            <StepRow n={1}>
              <Field
                ref={clientFieldRef}
                label="Nom du client *"
                badge={
                  isNewClient ? (
                    <span
                      className="ml-2 inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={{
                        background: "var(--brand-sage-50)",
                        color: "var(--brand-duck-500)",
                      }}
                    >
                      Nouveau client
                    </span>
                  ) : null
                }
                shake={clientInvalid}
              >
                <ClientCombobox
                  value={draft.clientNom}
                  onInput={(v) => patch({ clientNom: v, clientId: "" })}
                  onSelect={(c) =>
                    patch({
                      clientNom: c.nom,
                      clientId: c.id,
                      telephone: c.telephone ?? draft.telephone,
                    })
                  }
                  clients={clients}
                  invalid={clientInvalid}
                  inputRef={nomInputRef}
                />
              </Field>
            </StepRow>

            {/* Step 2 — Personne à joindre */}
            <StepRow n={2}>
              <Field label="Personne à joindre (optionnel)">
                <TextInput
                  value={draft.personneContact}
                  onChange={(v) => patch({ personneContact: v })}
                  placeholder="Optionnel"
                />
              </Field>
            </StepRow>

            {/* Step 3 — Téléphone */}
            <StepRow n={3}>
              <Field label="Téléphone (optionnel)">
                <TextInput
                  value={draft.telephone}
                  onChange={(v) =>
                    patch({ telephone: formatPhoneNumber(v) })
                  }
                  placeholder="01 23 45 67 89"
                  inputMode="tel"
                />
                {phoneConflict && (
                  <div
                    className="mt-1 flex items-center justify-between rounded-[8px] border px-2.5 py-1.5 text-[11.5px]"
                    style={{
                      background: "var(--color-urgent-soft)",
                      borderColor: "var(--color-urgent)",
                      color: "var(--color-urgent-ink)",
                    }}
                  >
                    <span>
                      Ce client a déjà un numéro ({matchedClient!.telephone}).
                    </span>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={overwritePhone}
                        onChange={(e) => setOverwritePhone(e.target.checked)}
                      />
                      <span className="font-semibold">Écraser</span>
                    </label>
                  </div>
                )}
              </Field>
            </StepRow>

            {/* Step 4 — Assigné à */}
            <StepRow n={4}>
              <Field label="Assigné à *">
                <OperatorPicker
                  value={draft.assignedTo}
                  onChange={(v) => patch({ assignedTo: v })}
                />
              </Field>
            </StepRow>

            {/* Step 5 — Date de livraison */}
            <StepRow n={5}>
              <Field label="Date de livraison (optionnel)">
                <div className="relative">
                  <input
                    type="date"
                    value={draft.dateLivraison}
                    onChange={(e) =>
                      patch({ dateLivraison: e.target.value })
                    }
                    className="block h-9 w-full rounded-[8px] border bg-white px-3 pr-8 font-mono text-[12.5px] tabular-nums"
                    style={{
                      borderColor: "var(--brand-sage-100)",
                      color: "var(--fg-1)",
                    }}
                  />
                  <span
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--fg-3)" }}
                  >
                    <Icon d={IC_CAL} size={14} />
                  </span>
                </div>
                <DateShortcuts
                  value={draft.dateLivraison}
                  onChange={(v) => patch({ dateLivraison: v })}
                />
              </Field>
            </StepRow>

            {/* Step 6 — Urgent */}
            <StepRow n={6}>
              <div className="flex items-center gap-3">
                <UrgentToggle
                  on={draft.isUrgent}
                  onChange={(v) => patch({ isUrgent: v })}
                />
                <span
                  className="text-[11.5px]"
                  style={{ color: "var(--fg-4)" }}
                >
                  Priorise dans la file de production
                </span>
              </div>
            </StepRow>

            {/* Step 7 — Lignes de commande */}
            <StepRow n={7}>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <SectionTitle as="span">Lignes de commande</SectionTitle>
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--fg-4)" }}
                  >
                    · {draft.lines.length} produit
                    {draft.lines.length > 1 ? "s" : ""}
                  </span>
                </div>
                <LineItemsEditor
                  items={draft.lines}
                  onChange={(lines) => patch({ lines })}
                  addLineRef={addLineRef}
                />
              </div>
            </StepRow>

            {/* Step 8 — Note interne */}
            <StepRow n={8}>
              <Field label="Note interne · optionnelle">
                <textarea
                  value={draft.notesGlobales}
                  onChange={(e) => patch({ notesGlobales: e.target.value })}
                  placeholder="Spécifications, remarques de production, contact particulier…"
                  rows={2}
                  className="block w-full rounded-[8px] border bg-white px-3 py-2 text-[12.5px] placeholder:text-[color:var(--fg-4)]"
                  style={{
                    borderColor: "var(--brand-sage-100)",
                    color: "var(--fg-1)",
                    resize: "vertical",
                  }}
                />
              </Field>
            </StepRow>

          </div>
        </div>

        {/* Footer — Step 9: Actions */}
        <div
          className="border-t"
          style={{
            padding: "12px 24px 16px",
            borderColor: "rgba(74,98,116,0.1)",
            background: "rgba(255,255,255,0.35)",
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <StepBubble n={9} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "var(--fg-3)" }}
            >
              Actions
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="h-10 rounded-[8px] border text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--color-danger)",
                color: "var(--color-danger)",
                background: "transparent",
              }}
            >
              Annuler la commande
            </button>
            <button
              type="button"
              disabled={submitting}
              className="h-10 rounded-[8px] border text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--brand-duck-500)",
                background: "white",
              }}
            >
              Envoyer au client
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                  toast.show("Brouillon enregistré", "info");
                } catch {
                  /* ignore */
                }
              }}
              disabled={submitting}
              className="h-10 rounded-[8px] border text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--brand-sage-100)",
                color: "var(--fg-2)",
                background: "white",
              }}
            >
              Sauvegarder dans un dossier
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
              style={{
                background: "var(--brand-duck-500)",
                cursor: !canSubmit ? "not-allowed" : "default",
              }}
            >
              {submitting ? (
                <>
                  <span
                    className="inline-block"
                    style={{ animation: "spin 900ms linear infinite", display: "inline-flex" }}
                  >
                    <Icon d={IC_LOADER} size={13} />
                  </span>
                  Création…
                </>
              ) : (
                "Ajouter au planning"
              )}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDiscard
        open={confirmDiscard}
        onConfirm={discardAndClose}
        onCancel={() => setConfirmDiscard(false)}
      />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  );
}

/* =========================================================================
   Small presentational helpers
   ========================================================================= */

function StepBubble({ n }: { n: number }) {
  return (
    <span
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: "var(--brand-duck-500)" }}
    >
      {n}
    </span>
  );
}

function StepRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="pt-[1px]">
        <StepBubble n={n} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SectionTitle({
  children,
  as: As = "h3",
}: {
  children: React.ReactNode;
  as?: "h3" | "span";
}) {
  return (
    <As
      className="text-[10px] font-bold uppercase tracking-[0.1em]"
      style={{ color: "var(--fg-3)" }}
    >
      {children}
    </As>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  shake?: boolean;
}

const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, children, badge, shake },
  ref
) {
  return (
    <div ref={ref} className={shake ? "olda-shake" : undefined}>
      <label className="mb-1 flex items-center text-[11px] font-medium">
        <span style={{ color: "var(--fg-3)" }}>{label}</span>
        {badge}
      </label>
      {children}
    </div>
  );
});

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  return (
    <input
      type="text"
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block h-9 w-full rounded-[8px] border bg-white px-3 text-[13px] placeholder:text-[color:var(--fg-4)]"
      style={{
        borderColor: "var(--brand-sage-100)",
        color: "var(--fg-1)",
      }}
    />
  );
}

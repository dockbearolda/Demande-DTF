import { useEffect, useMemo, useRef, useState } from "react";
import { type ProductCategoryId } from "../constants";
import { selectHeader, useNewOrderStore } from "../store";
import type { ValidationResult } from "../types";
import { IOSSwitch, Section } from "./primitives";
import { ClientSearchSelect } from "./ClientSearchSelect";
import { PreviousOrdersBlock } from "./PreviousOrdersBlock";
import { getCurrentUser } from "@/lib/currentUser";
import {
  checkRequestedDate,
  computeDeliveryEstimate,
  calculateMarginDays,
} from "../constants/delivery";

interface Props {
  errors: ValidationResult["fieldErrors"];
  /** Called when user leaves a field — lets parent run inline validation. */
  onFieldBlur?: (field: "clientNom") => void;
  /** Category currently selected (used to compute the date feasibility hint). */
  categoryId?: ProductCategoryId | null;
  /** Total quantity in the current line (for the date hint). */
  totalQty?: number;
  /**
   * Sous-ensemble de champs à afficher.
   *  - `"client"` : Client (étape 1 du wizard)
   *  - `"delivery"` : Date / Urgent / Notes (étape 4 du wizard)
   *  Défaut : tout afficher (utilisé hors flow wizard).
   */
  mode?: "client" | "delivery";
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      title="Champ valide"
      className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function DateFeasibilityHint({
  dateIso,
  categoryId,
  totalQty,
  isUrgent,
}: {
  dateIso: string;
  categoryId: ProductCategoryId | null;
  totalQty: number;
  isUrgent: boolean;
}) {
  if (!dateIso || !categoryId || totalQty <= 0) return null;
  const estimate = computeDeliveryEstimate(categoryId, totalQty, isUrgent);
  const status = checkRequestedDate(dateIso, estimate);
  if (!status) return null;

  if (status === "ok" || status === "tight") {
    const marginDays = calculateMarginDays(dateIso, estimate);
    const rangeLabel = estimate.minDays === estimate.maxDays
      ? `${estimate.minDays}j ouvré${estimate.minDays > 1 ? 's' : ''}`
      : `${estimate.minDays}–${estimate.maxDays}j ouvrés`;
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
        <DotIcon className="h-2 w-2 text-emerald-600" />
        ✓ {marginDays} jour{marginDays !== 1 ? 's' : ''} de marge sur le délai estimé ({rangeLabel})
      </p>
    );
  }
  return null;
}

/** Section header used for the always-visible "Infos supplémentaires" block —
 *  visually softer than top-level required fields so operators can scan past it
 *  when not needed, but never miss it. */
function SecondarySection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function OrderHeaderFields({
  errors,
  onFieldBlur,
  categoryId = null,
  totalQty = 0,
  mode,
}: Props) {
  const header = useNewOrderStore(selectHeader);
  const setHeader = useNewOrderStore((s) => s.setHeader);
  const setClient = useNewOrderStore((s) => s.setClient);
  const setAssignedTo = useNewOrderStore((s) => s.setAssignedTo);
  const setDateLivraison = useNewOrderStore((s) => s.setDateLivraison);
  const toggleUrgent = useNewOrderStore((s) => s.toggleUrgent);
  const setNotes = useNewOrderStore((s) => s.setNotes);

  // L'opérateur est défini par la session ouverte sur le poste (SessionGate).
  // On reflète automatiquement ce choix dans le draft sans afficher de sélecteur.
  useEffect(() => {
    if (header.assignedTo) return;
    const me = getCurrentUser();
    if (me) setAssignedTo(me);
  }, [header.assignedTo, setAssignedTo]);

  const showClient = !mode || mode === "client";
  const showDelivery = !mode || mode === "delivery";

  // Local "touched" set so the ✓ only appears once a field has been focused
  // and left — prevents a screenful of green ticks on initial render.
  const [touched, setTouched] = useState<Set<string>>(() => {
    const t = new Set<string>();
    if (header.clientNom.trim()) t.add("clientNom");
    return t;
  });
  function markTouched(field: string) {
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  // Le checkmark n'apparaît qu'une fois le client résolu (sélectionné dans
  // la liste — `clientId` non nul). Taper du texte libre ne suffit pas.
  const clientValid =
    !!header.clientId && !!header.clientNom.trim() && !errors.clientNom;

  return (
    <div className="space-y-6">
      {showClient && (
        <>
          {/* ───── REPRENDRE UNE COMMANDE ─────
              Visible uniquement après sélection d'un client — pré-remplit les
              références (étape 2) et les BAT (étape 3) depuis une commande
              existante pour épargner la ressaisie sur les recommandes B2B. */}
          {header.clientId && <PreviousOrdersBlock clientId={header.clientId} />}

          {/* ───── CLIENT ───── */}
          <Section
            label={
              <SectionLabelWithCheck
                label="Client"
                valid={touched.has("clientNom") && clientValid}
              />
            }
            name="clientNom"
            required
            error={touched.has("clientNom") ? errors.clientNom : undefined}
          >
            <ClientSearchSelect
              value={header.clientNom}
              onChange={(v) => setHeader({ clientNom: v, clientId: null })}
              onSelect={(c) => {
                setClient(c.id, c.nom, c.telephone ?? undefined);
                markTouched("clientNom");
                onFieldBlur?.("clientNom");
              }}
              onBlurValidate={() => {
                markTouched("clientNom");
                onFieldBlur?.("clientNom");
              }}
              invalid={touched.has("clientNom") && !!errors.clientNom}
              fieldId="field-clientNom"
              errorId="field-clientNom-error"
            />
          </Section>

        </>
      )}

      {showDelivery && (
        <>
          {/* ───── DATE + URGENT ───── */}
          <Section label="Date de livraison">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <DateField value={header.dateLivraison} onChange={setDateLivraison} />
              <div
                className={`inline-flex h-12 items-center justify-between gap-3 rounded-lg border px-3 transition ${
                  header.isUrgent
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    header.isUrgent ? "text-rose-700" : "text-slate-600"
                  }`}
                >
                  Urgent
                </span>
                <IOSSwitch
                  checked={header.isUrgent}
                  onChange={() => toggleUrgent()}
                  ariaLabel="Marquer comme urgent — synchronise le raccourci Urgent du sélecteur de date"
                  variant="danger"
                />
              </div>
            </div>
            <DateFeasibilityHint
              dateIso={header.dateLivraison}
              categoryId={categoryId}
              totalQty={totalQty}
              isUrgent={header.isUrgent}
            />
          </Section>

          {/* ───── SECONDARY: always visible, visually softer ───── */}
          <SecondarySection label="Infos supplémentaires">
            <Section label="Note additionnelle" name="notes">
              <textarea
                id="field-notes"
                value={header.notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Spécifications, contraintes de production…"
                rows={2}
                className="block w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-500 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 focus:border-slate-500"
              />
            </Section>
          </SecondarySection>
        </>
      )}
    </div>
  );
}

function SectionLabelWithCheck({
  label,
  valid,
}: {
  label: string;
  valid: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {label}
      {valid && <CheckBadge />}
    </span>
  );
}

// ───────── Date Field ─────────
//
// Apple-inspired date picker:
//  - Custom monthly calendar (no native <input type="date">)
//  - Pill-shaped selected day with soft shadow, today marker dot,
//    Monday-first weekday header, smooth fade/slide entrance.
//  - Keeps the original "Raccourcis" pills (Urgent / +3j / +5j / +7j / +15j).

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalIso(iso: string): Date | null {
  if (!iso) return null;
  // Force local-midnight parse so YYYY-MM-DD doesn't drift across timezones.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectedDate = parseLocalIso(value);
  const display = selectedDate
    ? selectedDate.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Sélectionner une date";

  const shortcuts: { label: string; days: number; danger?: boolean }[] = [
    { label: "Urgent", days: 1, danger: true },
    { label: "+3j", days: 3 },
    { label: "+5j", days: 5 },
    { label: "+7j", days: 7 },
    { label: "+15j", days: 15 },
  ];

  function addDays(base: Date, days: number): string {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return toLocalIso(d);
  }

  return (
    <div
      ref={ref}
      className={`relative ${open ? "z-50" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Date de livraison : ${display}` : "Sélectionner une date de livraison"}
        className={`flex h-12 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left text-base text-slate-900 transition-all duration-base ease-snap focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          open
            ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <CalendarIcon
            className={`h-[18px] w-[18px] transition-colors ${value ? "text-blue-600" : "text-slate-500"}`}
            aria-hidden="true"
          />
          <span className={value ? "font-medium text-slate-900" : "text-slate-500"}>
            {display}
          </span>
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
              }
            }}
            aria-label="Effacer la date"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>

      {open && (
        <CalendarPopover
          value={value}
          today={today}
          onPick={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
          shortcuts={shortcuts}
          onShortcut={(days) => {
            onChange(addDays(today, days));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ───────── Calendar Popover (Apple-style) ─────────

function CalendarPopover({
  value,
  today,
  onPick,
  shortcuts,
  onShortcut,
}: {
  value: string;
  today: Date;
  onPick: (iso: string) => void;
  shortcuts: { label: string; days: number; danger?: boolean }[];
  onShortcut: (days: number) => void;
}) {
  const selected = parseLocalIso(value);
  const initial = selected ?? today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  // Direction of the last month change — drives the slide animation.
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    // Monday-first index: Mon=0 ... Sun=6
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - leading);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    setSlideDir(delta > 0 ? "left" : "right");
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function goToday() {
    const sameView =
      viewMonth === today.getMonth() && viewYear === today.getFullYear();
    if (!sameView) {
      const goingForward =
        new Date(viewYear, viewMonth, 1).getTime() <
        new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      setSlideDir(goingForward ? "left" : "right");
    }
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "fr-FR",
    { month: "long", year: "numeric" },
  );
  const monthLabelCap =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const weekdays = ["L", "M", "M", "J", "V", "S", "D"];

  // Re-trigger CSS animation on month change by keying the grid.
  const gridKey = `${viewYear}-${viewMonth}`;

  return (
    <>
      <style>{`
        @keyframes dtfPopIn {
          0% { opacity: 0; transform: translateY(-6px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dtfSlideLeft {
          0% { opacity: 0; transform: translateX(8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes dtfSlideRight {
          0% { opacity: 0; transform: translateX(-8px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        role="dialog"
        aria-label="Sélecteur de date"
        className="absolute left-0 top-full z-50 mt-2 w-[336px] origin-top-left overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35),0_8px_20px_-12px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04]"
        style={{
          animation: "dtfPopIn 180ms cubic-bezier(0.32, 0.72, 0, 1) both",
        }}
      >
        {/* Header: month nav + title */}
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Mois précédent"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 active:scale-90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={goToday}
            aria-label="Aller à aujourd'hui"
            className="flex flex-col items-center rounded-lg px-3 py-1 text-center transition-colors hover:bg-slate-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className="text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
              {monthLabelCap}
            </span>
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Mois suivant"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 active:scale-90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Chevron direction="right" />
          </button>
        </div>

        {/* Weekday header */}
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {weekdays.map((w, i) => (
            <div key={i} className="py-1.5">
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div
          key={gridKey}
          className="grid grid-cols-7 gap-y-0.5"
          style={{
            animation: slideDir
              ? `${slideDir === "left" ? "dtfSlideLeft" : "dtfSlideRight"} 180ms cubic-bezier(0.32, 0.72, 0, 1) both`
              : undefined,
          }}
        >
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === viewMonth;
            const isSelected = selected ? isSameDay(d, selected) : false;
            const isToday = isSameDay(d, today);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            const baseColor = !inMonth
              ? "text-slate-300"
              : isWeekend
                ? "text-slate-500"
                : "text-slate-800";

            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(toLocalIso(d))}
                aria-label={d.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                aria-pressed={isSelected}
                className={[
                  "relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-medium transition-all duration-150 ease-snap focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.92]",
                  isSelected
                    ? "bg-blue-600 text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.55)] hover:bg-blue-600"
                    : isToday
                      ? "font-semibold text-blue-700 hover:bg-blue-50"
                      : `${baseColor} hover:bg-slate-100`,
                ].join(" ")}
              >
                <span className="leading-none">{d.getDate()}</span>
                {isToday && !isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Shortcuts */}
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Raccourcis
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onShortcut(s.days)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-all duration-150 ease-snap active:scale-[0.96] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  s.danger
                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70 hover:bg-rose-100"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                {s.danger && (
                  <span
                    aria-hidden="true"
                    className="block h-1.5 w-1.5 rounded-full bg-rose-600"
                  />
                )}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

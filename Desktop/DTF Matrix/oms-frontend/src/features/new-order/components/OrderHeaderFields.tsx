import { useEffect, useMemo, useRef, useState } from "react";
import { useClients } from "@/hooks/useClients";
import { formatPhoneNumber } from "@/lib/utils";
import type { Client } from "@/lib/types";
import { OPERATEURS, type ProductCategoryId } from "../constants";
import { selectHeader, useNewOrderStore } from "../store";
import type { OperatorValue, ValidationResult } from "../types";
import { IOSSwitch, Input, Section, SegmentedControl } from "./primitives";
import {
  checkRequestedDate,
  computeDeliveryEstimate,
} from "../constants/delivery";

interface Props {
  errors: ValidationResult["fieldErrors"];
  /** Called when user leaves a field — lets parent run inline validation. */
  onFieldBlur?: (field: "clientNom" | "assignedTo") => void;
  /** Category currently selected (used to compute the date feasibility hint). */
  categoryId?: ProductCategoryId | null;
  /** Total quantity in the current line (for the date hint). */
  totalQty?: number;
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
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

  if (status === "ok") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
        <DotIcon className="h-2 w-2 text-emerald-600" />
        Date atteignable selon le délai estimé.
      </p>
    );
  }
  if (status === "tight") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-700">
        <DotIcon className="h-2 w-2 text-amber-600" />
        Date serrée — proche de la borne minimale du délai estimé.
      </p>
    );
  }
  const earliest = new Date(estimate.earliestIso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-700">
      <DotIcon className="h-2 w-2 text-rose-600" />
      Date non atteignable. Plus tôt possible : {earliest}
      {isUrgent ? "" : " (sans urgence)"}.
    </p>
  );
}

export function OrderHeaderFields({
  errors,
  onFieldBlur,
  categoryId = null,
  totalQty = 0,
}: Props) {
  const header = useNewOrderStore(selectHeader);
  const setHeader = useNewOrderStore((s) => s.setHeader);
  const setClient = useNewOrderStore((s) => s.setClient);
  const setAssignedTo = useNewOrderStore((s) => s.setAssignedTo);
  const setDateLivraison = useNewOrderStore((s) => s.setDateLivraison);
  const toggleUrgent = useNewOrderStore((s) => s.toggleUrgent);

  const { data: clients = [] } = useClients();

  return (
    <>
      <Section label="Client" name="clientNom" required error={errors.clientNom}>
        <ClientAutocomplete
          value={header.clientNom}
          onChange={(v) => setHeader({ clientNom: v, clientId: null })}
          onSelect={(c) => setClient(c.id, c.nom, c.telephone ?? undefined)}
          onBlurValidate={() => onFieldBlur?.("clientNom")}
          clients={clients}
          invalid={!!errors.clientNom}
          fieldId="field-clientNom"
          errorId="field-clientNom-error"
        />
      </Section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Section label="Personne à joindre" name="personneContact">
          <Input
            value={header.personneContact}
            onChange={(v) => setHeader({ personneContact: v })}
            placeholder="Optionnel"
          />
        </Section>
        <Section label="Téléphone" name="telephone">
          <Input
            value={header.telephone}
            onChange={(v) => setHeader({ telephone: formatPhoneNumber(v) })}
            placeholder="01 23 45 67 89"
            inputMode="tel"
          />
        </Section>
      </div>

      <Section
        label="Assigné à"
        name="assignedTo"
        required
        error={errors.assignedTo}
      >
        <SegmentedControl
          ariaLabel="Assigné à"
          ariaDescribedBy={errors.assignedTo ? "field-assignedTo-error" : undefined}
          size="lg"
          value={header.assignedTo ?? null}
          onChange={(v) => {
            setAssignedTo(v as OperatorValue);
            onFieldBlur?.("assignedTo");
          }}
          options={OPERATEURS.map((op) => ({
            value: op.value,
            label: op.name,
          }))}
        />
      </Section>

      <Section label="Date de livraison">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <DateField value={header.dateLivraison} onChange={setDateLivraison} />
          <div
            className={`inline-flex h-11 items-center justify-between gap-3 rounded-lg border px-3 transition ${
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
              ariaLabel="Marquer comme urgent"
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
    </>
  );
}

// ───────── Client Autocomplete ─────────

function clientInitial(nom: string): string {
  return (nom.trim()[0] ?? "?").toUpperCase();
}

function avatarColor(seed: string): string {
  const palette = [
    "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
    "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-fuchsia-500",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function ClientAutocomplete({
  value,
  onChange,
  onSelect,
  onBlurValidate,
  clients,
  invalid,
  fieldId,
  errorId,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (c: Client) => void;
  onBlurValidate?: () => void;
  clients: Client[];
  invalid?: boolean;
  fieldId: string;
  errorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${fieldId}-listbox`;

  const matches = useMemo(() => {
    if (!value.trim()) return clients.slice(0, 8);
    const q = value.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.nom.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.telephone ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [clients, value]);

  useEffect(() => setHi(0), [value]);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={fieldId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={
          open && matches[hi] ? `${listboxId}-opt-${matches[hi].id}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => onBlurValidate?.()}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && matches[hi]) {
            e.preventDefault();
            onSelect(matches[hi]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Commencer à taper le nom du client…"
        // 16px base — readable at desk distance. 2px border on error
        // so it stays visible at a glance during a long shift.
        className={`block h-12 w-full rounded-lg bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          invalid
            ? "border-2 border-rose-600 focus:border-rose-700"
            : "border border-slate-300 focus:border-slate-500"
        }`}
      />

      {open && matches.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Clients suggérés"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-slate-300 bg-white p-1 shadow-xl"
        >
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`${listboxId}-opt-${c.id}`}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(c);
                setOpen(false);
              }}
              onMouseEnter={() => setHi(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                i === hi ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(c.nom)}`}
              >
                {clientInitial(c.nom)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{c.nom}</div>
                <div className="truncate text-xs text-slate-700">
                  {c.email ?? "—"}
                  {c.telephone ? ` · ${c.telephone}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────── Date Field ─────────

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const display = value
    ? new Date(value).toLocaleDateString("fr-FR", {
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
    return d.toISOString().slice(0, 10);
  }

  return (
    <div
      ref={ref}
      className="relative"
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
        className="flex h-12 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left text-base text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-slate-700" aria-hidden="true" />
          <span className={value ? "text-slate-900" : "text-slate-600"}>{display}</span>
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            aria-label="Effacer la date"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sélecteur de date"
          className="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-xl border border-slate-300 bg-white p-3 shadow-xl"
        >
          <input
            type="date"
            value={value}
            aria-label="Date de livraison"
            onChange={(e) => onChange(e.target.value)}
            className="block h-11 w-full rounded-md border border-slate-300 px-2 py-1.5 text-base text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Raccourcis
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    onChange(addDays(today, s.days));
                    setOpen(false);
                  }}
                  className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    s.danger
                      ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  {s.danger && (
                    <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-rose-700" />
                  )}
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useClients } from "@/hooks/useClients";
import { formatPhoneNumber } from "@/lib/utils";
import type { Client } from "@/lib/types";
import { OPERATEURS } from "../constants";
import { selectHeader, useNewOrderStore } from "../store";
import type { OperatorValue, ValidationResult } from "../types";
import { Input, PillButton, Section } from "./primitives";

interface Props {
  errors: ValidationResult["fieldErrors"];
}

export function OrderHeaderFields({ errors }: Props) {
  const header = useNewOrderStore(selectHeader);
  const setHeader = useNewOrderStore((s) => s.setHeader);
  const setClient = useNewOrderStore((s) => s.setClient);
  const setAssignedTo = useNewOrderStore((s) => s.setAssignedTo);
  const setDateLivraison = useNewOrderStore((s) => s.setDateLivraison);
  const toggleUrgent = useNewOrderStore((s) => s.toggleUrgent);

  const { data: clients = [] } = useClients();

  return (
    <>
      <Section label="Client" required error={errors.clientNom}>
        <ClientAutocomplete
          value={header.clientNom}
          onChange={(v) => setHeader({ clientNom: v, clientId: null })}
          onSelect={(c) => setClient(c.id, c.nom, c.telephone ?? undefined)}
          clients={clients}
          invalid={!!errors.clientNom}
        />
      </Section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Section label="Personne à joindre">
          <Input
            value={header.personneContact}
            onChange={(v) => setHeader({ personneContact: v })}
            placeholder="Optionnel"
          />
        </Section>
        <Section label="Téléphone">
          <Input
            value={header.telephone}
            onChange={(v) => setHeader({ telephone: formatPhoneNumber(v) })}
            placeholder="01 23 45 67 89"
            inputMode="tel"
          />
        </Section>
      </div>

      <Section label="Assigné à" required error={errors.assignedTo}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Assigné à">
          {OPERATEURS.map((op) => {
            const sel = header.assignedTo === op.value;
            return (
              <PillButton
                key={op.value}
                selected={sel}
                onClick={() => setAssignedTo(op.value as OperatorValue)}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    sel ? "bg-white/20 text-white" : "bg-slate-800 text-white"
                  }`}
                >
                  {op.initial}
                </span>
                <span>{op.name}</span>
              </PillButton>
            );
          })}
        </div>
      </Section>

      <Section label="Date de livraison">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <DateField value={header.dateLivraison} onChange={setDateLivraison} />
          <button
            type="button"
            onClick={toggleUrgent}
            aria-pressed={header.isUrgent}
            className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
              header.isUrgent
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span
              className={`block h-2 w-2 rounded-full ${
                header.isUrgent ? "bg-rose-500 ring-4 ring-rose-200" : "bg-slate-300"
              }`}
            />
            Urgent
          </button>
        </div>
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
  clients,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (c: Client) => void;
  clients: Client[];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
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
        aria-invalid={invalid || undefined}
        className={`block h-12 w-full rounded-lg border bg-white px-4 text-base text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
          invalid
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
            : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"
        }`}
      />

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {matches.map((c, i) => (
            <li
              key={c.id}
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
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(c.nom)}`}
              >
                {clientInitial(c.nom)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{c.nom}</div>
                <div className="truncate text-xs text-slate-500">
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          <span className={value ? "text-slate-800" : "text-slate-400"}>{display}</span>
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
          <div className="mt-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                  className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition ${
                    s.danger
                      ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {s.danger && (
                    <span className="block h-1.5 w-1.5 rounded-full bg-rose-500" />
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

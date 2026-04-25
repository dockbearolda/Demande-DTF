import { useEffect, useMemo, useRef, useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useCreateOrder } from "@/hooks/useOrders";
import { useSearchOrCreateClient } from "@/hooks/useCreateClientOrSearch";
import { formatPhoneNumber, generateReference } from "@/lib/utils";
import type { Client } from "@/lib/types";

/* ============================================================================
   Catalogues — secteur → produits + barème indicatif (€/unité)
   ========================================================================== */

type Secteur = "DTF" | "Pressage" | "UV" | "Trotec" | "Goodies" | "Autres";

const SECTEURS: Secteur[] = ["DTF", "Pressage", "UV", "Trotec", "Goodies", "Autres"];

const PRODUITS_PAR_SECTEUR: Record<Secteur, string[]> = {
  DTF: ["T-Shirt", "Polo", "Sweat", "Hoodie", "Veste", "Tote Bag", "Casquette"],
  Pressage: ["T-Shirt", "Polo", "Sweat", "Tablier", "Serviette"],
  UV: ["Mug", "Gourde", "Coque", "Plaque alu", "Verre"],
  Trotec: ["Plexi", "Bois", "Médaille", "Trophée", "Signalétique"],
  Goodies: ["Stylo", "Carnet", "Porte-clés", "Badge", "Sticker", "Magnet"],
  Autres: ["Sur-mesure"],
};

// Tarif unitaire (€) par secteur, avec dégressif quantité.
const TARIF: Record<Secteur, { tiers: { min: number; price: number }[] }> = {
  DTF: { tiers: [{ min: 1, price: 8 }, { min: 20, price: 6 }, { min: 50, price: 4.5 }, { min: 100, price: 3.5 }, { min: 200, price: 2.8 }] },
  Pressage: { tiers: [{ min: 1, price: 6 }, { min: 20, price: 4.5 }, { min: 50, price: 3.5 }, { min: 100, price: 2.8 }] },
  UV: { tiers: [{ min: 1, price: 12 }, { min: 20, price: 9 }, { min: 50, price: 7 }, { min: 100, price: 5.5 }] },
  Trotec: { tiers: [{ min: 1, price: 18 }, { min: 20, price: 14 }, { min: 50, price: 11 }] },
  Goodies: { tiers: [{ min: 1, price: 4 }, { min: 50, price: 2.5 }, { min: 200, price: 1.6 }, { min: 500, price: 1.1 }] },
  Autres: { tiers: [{ min: 1, price: 10 }] },
};

const QUANTITES_PRESET = [5, 10, 20, 50, 100, 200, 500];

const OPERATEURS = [
  { value: "L", initial: "L", name: "Loïc" },
  { value: "C", initial: "C", name: "Charlie" },
  { value: "M", initial: "M", name: "Mélina" },
] as const;

type OperatorValue = (typeof OPERATEURS)[number]["value"];

/* ============================================================================
   Helpers
   ========================================================================== */

function unitPriceFor(secteur: Secteur | "", quantite: number): number {
  if (!secteur || quantite <= 0) return 0;
  const tiers = [...TARIF[secteur].tiers].sort((a, b) => a.min - b.min);
  let price = tiers[0].price;
  for (const t of tiers) {
    if (quantite >= t.min) price = t.price;
    else break;
  }
  return price;
}

function formatEUR(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
}

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

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ============================================================================
   PillButton — primitive radio-style chip
   ========================================================================== */

function PillButton({
  selected,
  onClick,
  children,
  dashed = false,
  size = "md",
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dashed?: boolean;
  size?: "sm" | "md";
}) {
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
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!selected}
      onClick={onClick}
      className={`${base} ${sizeCls} ${
        selected
          ? "bg-slate-800 text-white shadow-sm ring-1 ring-slate-900/10"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================================================================
   Client Autocomplete
   ========================================================================== */

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
    const list = !value.trim()
      ? clients.slice(0, 8)
      : clients.filter((c) => {
          const q = value.toLowerCase();
          return (
            c.nom.toLowerCase().includes(q) ||
            (c.email ?? "").toLowerCase().includes(q) ||
            (c.telephone ?? "").toLowerCase().includes(q)
          );
        }).slice(0, 8);
    return list;
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

/* ============================================================================
   Date Picker (popover) avec raccourcis rapides
   ========================================================================== */

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
    ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "Sélectionner une date";

  const shortcuts: { label: string; days: number; danger?: boolean }[] = [
    { label: "Urgent", days: 1, danger: true },
    { label: "+3j", days: 3 },
    { label: "+5j", days: 5 },
    { label: "+7j", days: 7 },
    { label: "+15j", days: 15 },
  ];

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
                  {s.danger && <span className="block h-1.5 w-1.5 rounded-full bg-rose-500" />}
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/* ============================================================================
   NewOrderForm
   ========================================================================== */

interface FormState {
  clientNom: string;
  clientId: string;
  personneContact: string;
  telephone: string;
  assignedTo: OperatorValue | "";
  dateLivraison: string;
  isUrgent: boolean;
  secteur: Secteur | "";
  produit: string;
  quantite: number;
  customQty: string;
  customProduit: string;
  notes: string;
}

const EMPTY: FormState = {
  clientNom: "",
  clientId: "",
  personneContact: "",
  telephone: "",
  assignedTo: "",
  dateLivraison: "",
  isUrgent: false,
  secteur: "",
  produit: "",
  quantite: 0,
  customQty: "",
  customProduit: "",
  notes: "",
};

export interface NewOrderFormProps {
  onCreated?: (orderId: string) => void;
  onStudioBat?: (draft: FormState) => void;
  onCancel?: () => void;
}

export function NewOrderForm({ onCreated, onStudioBat, onCancel }: NewOrderFormProps) {
  const { data: clients = [] } = useClients();
  const createOrder = useCreateOrder();
  const searchClient = useSearchOrCreateClient();

  const [s, setS] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCustomProduit, setShowCustomProduit] = useState(false);
  const [showCustomQty, setShowCustomQty] = useState(false);

  const patch = (p: Partial<FormState>) => setS((prev) => ({ ...prev, ...p }));

  const produits = s.secteur ? PRODUITS_PAR_SECTEUR[s.secteur] : [];

  const effectiveProduit = showCustomProduit ? s.customProduit.trim() : s.produit;
  const effectiveQty = showCustomQty ? Number(s.customQty) || 0 : s.quantite;

  const unit = unitPriceFor(s.secteur, effectiveQty);
  const totalEstime = unit * effectiveQty;

  function selectClient(c: Client) {
    patch({
      clientNom: c.nom,
      clientId: c.id,
      telephone: c.telephone ?? s.telephone,
    });
  }

  function selectSecteur(sec: Secteur) {
    patch({ secteur: sec, produit: "", customProduit: "" });
    setShowCustomProduit(false);
  }

  function selectProduit(p: string) {
    patch({ produit: p, customProduit: "" });
    setShowCustomProduit(false);
  }

  function selectQty(q: number) {
    patch({ quantite: q, customQty: "" });
    setShowCustomQty(false);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!s.clientNom.trim()) e.client = "Client requis";
    if (!s.assignedTo) e.assignedTo = "Choisir un opérateur";
    if (!s.secteur) e.secteur = "Choisir un secteur";
    if (!effectiveProduit) e.produit = "Choisir un produit";
    if (!effectiveQty || effectiveQty <= 0) e.quantite = "Quantité requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function buildPayload() {
    const clientRes = await searchClient.mutateAsync(s.clientNom.trim());
    return {
      client_id: clientRes.id,
      reference: generateReference(),
      assigned_to: s.assignedTo,
      personne_contact: s.personneContact.trim() || null,
      telephone: s.telephone.trim() || null,
      date_livraison_prevue: s.dateLivraison || null,
      is_urgent: s.isUrgent,
      notes_globales: s.notes.trim() || null,
      lines: [
        {
          ligne_numero: 1,
          secteur: s.secteur,
          produit: effectiveProduit,
          quantite: effectiveQty,
          notes: null,
        },
      ],
    };
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      const order = await createOrder.mutateAsync(payload);
      onCreated?.(order.id);
      setS(EMPTY);
      setShowCustomQty(false);
      setShowCustomProduit(false);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleStudioBat() {
    if (!validate()) return;
    onStudioBat?.(s);
  }

  return (
    <form
      onSubmit={handleCreate}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleCreate();
        }
      }}
      className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8"
    >
      {/* En-tête */}
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Nouvelle commande</h2>
          <p className="mt-0.5 text-xs text-slate-500">Saisie rapide · point of sale</p>
        </div>
      </header>

      <div className="space-y-7">
        {/* 1. Client */}
        <Section label="Client" required error={errors.client}>
          <ClientAutocomplete
            value={s.clientNom}
            onChange={(v) => patch({ clientNom: v, clientId: "" })}
            onSelect={selectClient}
            clients={clients}
            invalid={!!errors.client}
          />
        </Section>

        {/* 2. Contact */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Section label="Personne à joindre">
            <Input
              value={s.personneContact}
              onChange={(v) => patch({ personneContact: v })}
              placeholder="Optionnel"
            />
          </Section>
          <Section label="Téléphone">
            <Input
              value={s.telephone}
              onChange={(v) => patch({ telephone: formatPhoneNumber(v) })}
              placeholder="01 23 45 67 89"
              inputMode="tel"
            />
          </Section>
        </div>

        {/* 3. Assigné à */}
        <Section label="Assigné à" required error={errors.assignedTo}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Assigné à">
            {OPERATEURS.map((op) => {
              const sel = s.assignedTo === op.value;
              return (
                <PillButton key={op.value} selected={sel} onClick={() => patch({ assignedTo: op.value })}>
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

        {/* 4. Date de livraison + urgent */}
        <Section label="Date de livraison">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <DateField value={s.dateLivraison} onChange={(v) => patch({ dateLivraison: v })} />
            <button
              type="button"
              onClick={() => patch({ isUrgent: !s.isUrgent })}
              aria-pressed={s.isUrgent}
              className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
                s.isUrgent
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`block h-2 w-2 rounded-full ${
                  s.isUrgent ? "bg-rose-500 ring-4 ring-rose-200" : "bg-slate-300"
                }`}
              />
              Urgent
            </button>
          </div>
        </Section>

        {/* 5. Secteur */}
        <Section label="Secteur" required error={errors.secteur}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Secteur">
            {SECTEURS.map((sec) => (
              <PillButton key={sec} selected={s.secteur === sec} onClick={() => selectSecteur(sec)}>
                {sec}
              </PillButton>
            ))}
          </div>
        </Section>

        {/* 6. Produit (cascade selon secteur) */}
        {s.secteur && (
          <Section label="Produit" required error={errors.produit}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Produit">
              {produits.map((p) => (
                <PillButton key={p} selected={s.produit === p && !showCustomProduit} onClick={() => selectProduit(p)}>
                  {p}
                </PillButton>
              ))}
              <PillButton
                dashed
                onClick={() => {
                  setShowCustomProduit(true);
                  patch({ produit: "" });
                }}
              >
                + Autre…
              </PillButton>
            </div>
            {showCustomProduit && (
              <div className="mt-3 max-w-xs">
                <Input
                  value={s.customProduit}
                  onChange={(v) => patch({ customProduit: v })}
                  placeholder="Nom du produit personnalisé"
                  autoFocus
                />
              </div>
            )}
          </Section>
        )}

        {/* 7. Quantité */}
        <Section label="Quantité" required error={errors.quantite}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {QUANTITES_PRESET.map((q) => {
              const sel = s.quantite === q && !showCustomQty;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => selectQty(q)}
                  className={`flex h-14 items-center justify-center rounded-lg text-base font-semibold transition ${
                    sel
                      ? "bg-slate-800 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {q}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setShowCustomQty(true);
                patch({ quantite: 0 });
              }}
              className={`flex h-14 items-center justify-center rounded-lg border border-dashed text-sm font-medium transition ${
                showCustomQty
                  ? "border-slate-400 bg-slate-100 text-slate-700"
                  : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
              }`}
            >
              + Autre…
            </button>
          </div>
          {showCustomQty && (
            <div className="mt-3 max-w-[140px]">
              <Input
                value={s.customQty}
                onChange={(v) => patch({ customQty: v.replace(/[^0-9]/g, "") })}
                placeholder="Qté libre"
                inputMode="numeric"
                autoFocus
              />
            </div>
          )}
        </Section>

        {/* 8. Note */}
        <Section label="Note additionnelle">
          <textarea
            value={s.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Spécifications, contraintes de production…"
            rows={3}
            className="block w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
        </Section>
      </div>

      {/* Footer — prix + actions */}
      <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total estimé</span>
          <span className="font-mono text-2xl font-bold tabular-nums text-slate-800">
            {totalEstime > 0 ? formatEUR(totalEstime) : "—"}
          </span>
          {effectiveQty > 0 && unit > 0 && (
            <span className="text-xs text-slate-500">
              {effectiveQty} × {formatEUR(unit)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-lg px-4 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            onClick={handleStudioBat}
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <BatIcon className="h-4 w-4" />
            Passer au Studio BAT
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50"
          >
            {submitting ? "Création…" : "Créer"}
            <kbd className="ml-0.5 inline-flex h-5 items-center gap-1 rounded bg-white/15 px-1.5 text-[10px] font-medium text-white/90">
              ⏎
            </kbd>
          </button>
        </div>
      </div>

      {errors.submit && (
        <p className="mt-3 text-right text-xs text-rose-600">{errors.submit}</p>
      )}
    </form>
  );
}

/* ============================================================================
   Petites primitives présentationnelles
   ========================================================================== */

function Section({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </span>
        {error && <span className="text-[10px] font-medium text-rose-500">· {error}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  inputMode,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "numeric" | "text";
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      autoFocus={autoFocus}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
    />
  );
}

function BatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

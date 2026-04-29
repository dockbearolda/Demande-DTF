import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useClients, useCreateClient } from "@/hooks/useClients";
import { useOrders } from "@/hooks/useOrders";
import { getRecentClientIds } from "@/lib/recentClients";
import type { Client, Order } from "@/lib/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (c: Client) => void;
  onBlurValidate?: () => void;
  invalid?: boolean;
  fieldId: string;
  errorId: string;
}

// Number of recents shown as chips at the top when no query.
const RECENTS_CHIP_LIMIT = 6;

export function ClientSearchSelect({
  value,
  onChange,
  onSelect,
  onBlurValidate,
  invalid,
  fieldId,
  errorId,
}: Props) {
  const { data: clients = [] } = useClients();
  const { data: orders = [] } = useOrders();
  const createClient = useCreateClient();

  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${fieldId}-listbox`;

  // ───────── Order stats per client (for ranking + subline) ─────────
  const { orderCountById, latestOrderById } = useMemo(() => {
    const counts = new Map<string, number>();
    const latest = new Map<string, Order>();
    for (const o of orders as Order[]) {
      counts.set(o.client_id, (counts.get(o.client_id) ?? 0) + 1);
      const existing = latest.get(o.client_id);
      if (!existing || existing.date_commande < o.date_commande) {
        latest.set(o.client_id, o);
      }
    }
    return { orderCountById: counts, latestOrderById: latest };
  }, [orders]);

  // ───────── Recents ─────────
  const recentIds = useMemo(() => getRecentClientIds(), [clients.length, open]);
  const recentClients = useMemo(
    () =>
      recentIds
        .map((id) => clients.find((c) => c.id === id))
        .filter((c): c is Client => !!c),
    [recentIds, clients],
  );

  // ───────── Filtered + ranked matches ─────────
  const trimmedQuery = value.trim();
  const matches = useMemo<Client[]>(() => {
    if (!trimmedQuery) {
      // No query: surface recents first, then ALL other clients sorted by
      // most-active, then alphabetically. The dropdown scrolls if needed.
      const seen = new Set<string>();
      const list: Client[] = [];
      for (const c of recentClients) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        list.push(c);
      }
      const rest = [...clients]
        .filter((c) => !seen.has(c.id))
        .sort(
          (a, b) =>
            (orderCountById.get(b.id) ?? 0) - (orderCountById.get(a.id) ?? 0) ||
            a.nom.localeCompare(b.nom),
        );
      for (const c of rest) list.push(c);
      return list;
    }

    const nq = normalize(trimmedQuery);
    type Scored = { client: Client; rank: number; freq: number };
    const scored: Scored[] = [];
    for (const c of clients) {
      const nNom = normalize(c.nom);
      const nEmail = normalize(c.email ?? "");
      const nTel = normalize(c.telephone ?? "");
      const nContact = normalize(c.contact ?? "");
      const nVille = normalize(c.ville ?? "");

      // Rank: 0 = exact name, 1 = name prefix, 2 = name substring,
      // 3 = substring on contact / email / telephone / ville, 4 = no match.
      let rank = 4;
      if (nNom === nq) rank = 0;
      else if (nNom.startsWith(nq)) rank = 1;
      else if (nNom.includes(nq)) rank = 2;
      else if (
        nContact.includes(nq) ||
        nEmail.includes(nq) ||
        nTel.includes(nq) ||
        nVille.includes(nq)
      )
        rank = 3;

      if (rank < 4) {
        scored.push({
          client: c,
          rank,
          freq: orderCountById.get(c.id) ?? 0,
        });
      }
    }

    // Sort: rank ASC, then frequency DESC, then name ASC for stability.
    scored.sort(
      (a, b) =>
        a.rank - b.rank ||
        b.freq - a.freq ||
        a.client.nom.localeCompare(b.client.nom),
    );
    return scored.map((s) => s.client);
  }, [trimmedQuery, clients, recentClients, orderCountById]);

  // ───────── Selected/orphan flags ─────────
  // A "selected" match is one whose normalized name equals the query
  // AND we have its id stored — i.e. the user really committed a row.
  const exactClient = useMemo(() => {
    if (!trimmedQuery) return null;
    const nq = normalize(trimmedQuery);
    return clients.find((c) => normalize(c.nom) === nq) ?? null;
  }, [clients, trimmedQuery]);

  const orphan = !!trimmedQuery && !exactClient && !creating;

  // ───────── Effects ─────────
  useEffect(() => setHi(0), [value, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ───────── Handlers ─────────
  function commitClient(c: Client) {
    onSelect(c);
    setOpen(false);
    setCreating(false);
  }

  function openCreateForm() {
    setCreating(true);
    setOpen(false);
  }

  // ───────── Render ─────────
  const showRecents = recentClients.length > 0 && !trimmedQuery;
  const selectedHint = exactClient ? latestOrderById.get(exactClient.id) : undefined;
  const selectedCount = exactClient ? orderCountById.get(exactClient.id) ?? 0 : 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <input
            id={fieldId}
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open && matches.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={
              open && matches[hi]
                ? `${listboxId}-opt-${matches[hi].id}`
                : undefined
            }
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
              setCreating(false);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => onBlurValidate?.()}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setHi((h) => Math.min(h + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                if (open && matches[hi]) {
                  e.preventDefault();
                  e.stopPropagation();
                  commitClient(matches[hi]);
                } else if (orphan) {
                  e.preventDefault();
                  e.stopPropagation();
                  openCreateForm();
                }
              } else if (e.key === "Escape") {
                if (open) {
                  e.stopPropagation();
                  setOpen(false);
                }
              }
            }}
            placeholder="Tape le nom d'un client — ↓ pour parcourir, Enter pour valider"
            className={`block h-12 w-full rounded-lg bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              invalid
                ? "border-2 border-rose-600 focus:border-rose-700"
                : "border border-slate-300 focus:border-slate-500"
            }`}
          />

          {/* Hint when an exact match is selected and the popover is closed. */}
          {!open && exactClient && (
            <p className="mt-1.5 text-[11px] text-slate-600">
              {selectedHint ? (
                <>
                  Dernière commande :{" "}
                  <span className="font-mono font-semibold">
                    {formatShortDate(selectedHint.date_commande)}
                  </span>
                </>
              ) : (
                "Aucune commande encore"
              )}
              {selectedCount > 0 && (
                <>
                  {" "}· {selectedCount} commande
                  {selectedCount > 1 ? "s" : ""} au total
                </>
              )}
            </p>
          )}
        </div>

        {/* "NOUVEAU CLIENT" badge + button — only when input has value, no
            exact match, and we are not already in the create form. */}
        {orphan && !open && (
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex h-7 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-700"
              style={{ background: "var(--brand-sage-50)" }}
            >
              Nouveau client
            </span>
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <PlusIcon className="h-4 w-4" />
              Créer le client
            </button>
          </div>
        )}
      </div>

      {/* Inline mini-form for client creation. */}
      {creating && (
        <NewClientInlineForm
          initialName={trimmedQuery}
          submitting={createClient.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={async (payload) => {
            const c = await createClient.mutateAsync(payload);
            commitClient(c);
          }}
        />
      )}

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Clients suggérés"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-auto rounded-xl border border-slate-300 bg-white p-2 shadow-xl"
        >
          {showRecents && (
            <div className="mb-2">
              <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Récents
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentClients.slice(0, RECENTS_CHIP_LIMIT).map((c) => (
                  <button
                    key={`recent-${c.id}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitClient(c);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-800"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(c.nom)}`}
                    >
                      {clientInitial(c.nom)}
                    </span>
                    {c.nom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {matches.length === 0 && trimmedQuery && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Aucun résultat — Enter ou « Créer le client » pour ouvrir la
              fiche.
            </div>
          )}

          {matches.length === 0 && !trimmedQuery && !showRecents && (
            <div className="px-3 py-2 text-sm text-slate-500">
              Tape le début du nom du client.
            </div>
          )}

          <ul role="presentation" className="space-y-0.5">
            {matches.map((c, i) => {
              const active = i === hi;
              const count = orderCountById.get(c.id) ?? 0;
              const last = latestOrderById.get(c.id);
              const extraContactCount = c.contacts?.length ?? 0;
              const contactBits = [c.contact, c.ville].filter(
                (s): s is string => !!s && s.trim().length > 0,
              );
              const reachBits = [c.telephone, c.email].filter(
                (s): s is string => !!s && s.trim().length > 0,
              );
              return (
                <li
                  key={c.id}
                  id={`${listboxId}-opt-${c.id}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitClient(c);
                  }}
                  onMouseEnter={() => setHi(i)}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 ${
                    active ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(c.nom)}`}
                  >
                    {clientInitial(c.nom)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {c.nom}
                      </div>
                      {extraContactCount > 0 && (
                        <span className="inline-flex h-5 flex-none items-center rounded-full bg-blue-50 px-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                          +{extraContactCount} contact{extraContactCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {contactBits.length > 0 && (
                      <div className="truncate text-xs text-slate-700">
                        {contactBits.join(" · ")}
                      </div>
                    )}
                    {reachBits.length > 0 && (
                      <div className="truncate text-[11px] text-slate-500">
                        {reachBits.join(" · ")}
                      </div>
                    )}
                    <div className="truncate text-[11px] text-slate-500">
                      {last
                        ? `Dernière commande : ${formatShortDate(last.date_commande)}`
                        : "Aucune commande encore"}
                      {count > 0
                        ? ` · ${count} commande${count > 1 ? "s" : ""} au total`
                        : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {matches.length > 0 && (
            <div className="mt-1 border-t border-slate-100 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {matches.length} client{matches.length > 1 ? "s" : ""}
              {trimmedQuery ? " trouvé" : ""}
              {matches.length > 1 && trimmedQuery ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────── Inline create form ─────────

interface NewClientPayload {
  nom: string;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
}

function NewClientInlineForm({
  initialName,
  submitting,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: NewClientPayload) => Promise<void> | void;
}) {
  const [nom, setNom] = useState(initialName);
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nomRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nomRef.current?.focus();
    nomRef.current?.select();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!nom.trim()) {
      setError("La raison sociale est requise.");
      return;
    }
    setError(null);
    try {
      await onSubmit({
        nom: nom.trim(),
        contact: contact.trim() || null,
        email: email.trim() || null,
        telephone: telephone.trim() || null,
      });
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Création impossible. Réessaie.";
      setError(typeof detail === "string" ? detail : "Création impossible.");
    }
  }

  return (
    <div
      className="mt-3 rounded-xl border p-4"
      style={{
        background: "var(--brand-sage-50)",
        borderColor: "var(--brand-sage-100)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
          Nouvelle fiche client
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] font-semibold text-slate-600 underline-offset-2 hover:underline"
        >
          Annuler
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <FieldRow label="Raison sociale *">
          <input
            ref={nomRef}
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="ex. Vito SARL"
            className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          />
        </FieldRow>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <FieldRow label="Contact">
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="ex. Jean Dupont"
              className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
            />
          </FieldRow>
          <FieldRow label="Téléphone">
            <input
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
            />
          </FieldRow>
        </div>
        <FieldRow label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@exemple.fr"
            className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          />
        </FieldRow>
        {error && (
          <p className="text-[12px] font-semibold text-rose-700">{error}</p>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-white/60"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !nom.trim()}
            className="inline-flex h-9 items-center rounded-lg bg-[#4A6274] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a4e5d] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Création…" : "Créer & sélectionner"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

// ───────── Helpers ─────────

const DIACRITICS_RE = /[̀-ͯ]/g;

/** NFD-normalize + strip combining diacritical marks, lower-case. */
function normalize(s: string): string {
  return s.normalize("NFD").replace(DIACRITICS_RE, "").toLowerCase().trim();
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function clientInitial(nom: string): string {
  return (nom.trim()[0] ?? "?").toUpperCase();
}

function avatarColor(seed: string): string {
  const palette = [
    "bg-rose-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-fuchsia-500",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
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

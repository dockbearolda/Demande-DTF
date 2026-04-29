import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Check, ExternalLink, X } from "lucide-react";
import { useSearchBats, type BatSearchResult } from "@/hooks/useBats";
import type { LinkedBatRef, TextileColor, TextileModel } from "../types";

interface BatPickerProps {
  /** Couleur ciblée pour cette sélection. */
  color: TextileColor;
  /** Modèle textile (référence utilisée pour pré-filtrer). */
  model: TextileModel | null;
  /** Client sélectionné dans S8 (filtre prioritaire). */
  clientId: string | null;
  /** Si déjà lié, le BAT actif. */
  linked: LinkedBatRef | null;
  /** Lance la liaison. */
  onLink: (ref: LinkedBatRef) => void;
  /** Retire la liaison. */
  onUnlink: () => void;
}

/**
 * BatPicker — sélecteur de BAT existant pour une couleur donnée.
 *
 * - Recherche debounce 250 ms par texte libre (ref commande, client, fichier)
 * - Filtre auto sur le client + référence modèle + color id
 * - Liste avec miniature, badge statut, compteur d'usage
 * - Aperçu plein écran avant validation
 */
export function BatPicker({
  color,
  model,
  clientId,
  linked,
  onLink,
  onUnlink,
}: BatPickerProps) {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [scope, setScope] = useState<"client" | "all">(
    clientId ? "client" : "all",
  );
  const [previewBat, setPreviewBat] = useState<BatSearchResult | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(rawQuery.trim()), 250);
    return () => window.clearTimeout(id);
  }, [rawQuery]);

  // If client is unset, fallback to "all" automatically.
  useEffect(() => {
    if (!clientId && scope === "client") setScope("all");
  }, [clientId, scope]);

  const { data, isFetching, isError } = useSearchBats({
    client_id: scope === "client" ? clientId : null,
    model_reference: model?.reference ?? null,
    color_id: color.id,
    query: debouncedQuery || undefined,
    days: 365,
    limit: 60,
    enabled: true,
  });

  // Sort: APPROVED first, then by created_at desc.
  const results = useMemo(() => {
    const list = data ?? [];
    const score = (b: BatSearchResult) => (b.status === "APPROVED" ? 0 : 1);
    return [...list].sort((a, b) => {
      const s = score(a) - score(b);
      if (s !== 0) return s;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [data]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      {/* Header — color label + search field */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`block h-6 w-6 flex-none rounded-full ${color.swatchBorder ? "ring-1 ring-slate-300" : ""}`}
          style={{ backgroundColor: color.hex }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900">
            {color.label}
          </div>
          <div className="text-[11px] text-slate-500">
            Choisir un BAT existant
          </div>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
          <button
            type="button"
            onClick={() => setScope("client")}
            disabled={!clientId}
            className={`px-2.5 py-1.5 font-semibold transition disabled:opacity-40 ${
              scope === "client"
                ? "bg-[#4A6274] text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title={clientId ? "Limiter au client courant" : "Aucun client sélectionné"}
          >
            Client
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`border-l border-slate-200 px-2.5 py-1.5 font-semibold transition ${
              scope === "all"
                ? "bg-[#4A6274] text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Tous
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Rechercher : ref commande, client, nom de fichier…"
          className="block w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {/* Currently linked banner */}
      {linked && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#4A6274]/30 bg-[#4A6274]/10 px-3 py-2 text-[12px]">
          <div className="flex min-w-0 items-center gap-2 text-[#3a4e5d]">
            <span className="inline-flex h-5 items-center rounded-full bg-[#4A6274] px-2 text-[10px] font-bold uppercase tracking-wider text-white">
              Lié
            </span>
            <span className="truncate font-mono">{linked.sourceOrderReference}</span>
            <span className="truncate text-[#4A6274]">· {linked.sourceClientName}</span>
          </div>
          <button
            type="button"
            onClick={onUnlink}
            className="inline-flex h-6 items-center gap-1 rounded text-[11px] font-semibold text-rose-600 hover:underline"
          >
            <X className="h-3 w-3" />
            Retirer
          </button>
        </div>
      )}

      {/* Results list */}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-100">
        {isFetching && results.length === 0 && (
          <div className="px-3 py-4 text-center text-[12px] text-slate-500">
            Recherche…
          </div>
        )}
        {isError && (
          <div className="px-3 py-4 text-center text-[12px] text-rose-600">
            Erreur lors de la recherche
          </div>
        )}
        {!isFetching && !isError && results.length === 0 && (
          <div className="px-3 py-6 text-center text-[12px] text-slate-500">
            {scope === "client" && clientId
              ? "Aucun BAT existant pour ce client sur cette couleur"
              : "Aucun BAT trouvé"}
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {results.map((b) => (
            <BatRow
              key={b.id}
              bat={b}
              isSelected={linked?.batId === b.id}
              onPreview={() => setPreviewBat(b)}
              onSelect={() => onLink(toLinkedRef(b))}
            />
          ))}
        </ul>
      </div>

      {previewBat && (
        <BatPreviewOverlay
          bat={previewBat}
          isSelected={linked?.batId === previewBat.id}
          onClose={() => setPreviewBat(null)}
          onSelect={() => {
            onLink(toLinkedRef(previewBat));
            setPreviewBat(null);
          }}
        />
      )}
    </div>
  );
}

function toLinkedRef(b: BatSearchResult): LinkedBatRef {
  return {
    batId: b.id,
    sourceOrderReference: b.order_reference,
    sourceClientName: b.client_name,
    fileUrl: b.file_url,
    fileType: b.file_type,
    createdAt: b.created_at,
    decidedAt: b.decided_at,
    status: b.status,
    version: b.version,
    usageCount: b.usage_count,
  };
}

interface BatRowProps {
  bat: BatSearchResult;
  isSelected: boolean;
  onPreview: () => void;
  onSelect: () => void;
}

function BatRow({ bat, isSelected, onPreview, onSelect }: BatRowProps) {
  const isImage = bat.file_type === "png" || bat.file_type === "jpg";
  const dateLabel = new Date(bat.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  return (
    <li
      className={`flex items-center gap-3 px-2.5 py-2 transition ${
        isSelected ? "bg-[#4A6274]/10" : "hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={onPreview}
        className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200 transition hover:ring-slate-400"
        aria-label="Aperçu plein écran"
        title="Aperçu plein écran"
      >
        {isImage ? (
          <img
            src={bat.file_url}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-[10px] font-bold uppercase text-slate-500">
            PDF
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[12px] font-semibold text-slate-900">
            {bat.order_reference}
          </span>
          <BatStatusPill status={bat.status} />
          {bat.usage_count > 1 && (
            <span className="inline-flex h-4 items-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">
              ×{bat.usage_count}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">
          {bat.client_name} · {dateLabel} · v{bat.version}
        </div>
      </div>
      <div className="flex flex-none items-center gap-1.5">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
          title="Aperçu"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onSelect}
          className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${
            isSelected
              ? "bg-[#4A6274] text-white"
              : "bg-[#4A6274] text-white hover:bg-[#3a4e5d]"
          }`}
        >
          <Check className="h-3 w-3" />
          {isSelected ? "Sélectionné" : "Choisir"}
        </button>
      </div>
    </li>
  );
}

function BatStatusPill({ status }: { status: BatSearchResult["status"] }) {
  const map: Record<BatSearchResult["status"], { label: string; cls: string }> = {
    APPROVED: { label: "Validé", cls: "bg-emerald-100 text-emerald-800" },
    PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
    REJECTED: { label: "Rejeté", cls: "bg-rose-100 text-rose-800" },
    EXPIRED: { label: "Expiré", cls: "bg-slate-100 text-slate-500" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex h-4 items-center rounded-full px-1.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

interface BatPreviewOverlayProps {
  bat: BatSearchResult;
  isSelected: boolean;
  onClose: () => void;
  onSelect: () => void;
}

function BatPreviewOverlay({
  bat,
  isSelected,
  onClose,
  onSelect,
}: BatPreviewOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isImage = bat.file_type === "png" || bat.file_type === "jpg";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu BAT ${bat.order_reference}`}
      className="fixed inset-0 z-[80] flex flex-col bg-slate-900/85 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-5 py-3 text-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold">
              {bat.order_reference}
            </span>
            <BatStatusPill status={bat.status} />
            <span className="text-[11px] text-slate-400">v{bat.version}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {bat.client_name} ·{" "}
            {new Date(bat.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <Check className="h-3.5 w-3.5" />
            {isSelected ? "Déjà sélectionné" : "Choisir ce BAT"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        {isImage ? (
          <img
            src={bat.file_url}
            alt={bat.order_reference}
            decoding="async"
            className="max-h-full max-w-full rounded-lg shadow-xl"
          />
        ) : (
          <iframe
            src={bat.file_url}
            title={bat.order_reference}
            className="h-full w-full max-w-4xl rounded-lg bg-white shadow-xl"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { getTextileModel } from "../runtimeCatalog";
import { computeTotals, formatEUR } from "../pricing";
import { useNewOrderStore } from "../store";
import {
  isTextileLine,
  type OrderLineRecord,
  type TextileColor,
  type TextileLine,
} from "../types";
import { ProductIcon } from "./ProductIcon";
import type { ProductTarget } from "./ProductIcon";
import { useBatEditor } from "../useBatEditor";

type RowState = "none" | "in_progress" | "validated";

interface ReferenceRowProps {
  record: OrderLineRecord;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Other textile lines that share at least one color and have a BAT —
   *  used to populate the "Dupliquer depuis…" submenu. */
  duplicateSources: OrderLineRecord[];
}

/**
 * Refonte étape 2 — une ligne par référence.
 * Zone 1 (récap commande, ~78%) : vignette, nom, SKU, pastilles couleur,
 * tailles/quantités, prix HT/u et sous-total. Cliquable → déplie l'accordion.
 * Zone 2 (action BAT, ~22%) : CTA contextuel selon l'état + kebab.
 */
export function ReferenceRow({
  record,
  index,
  isExpanded,
  onToggleExpand,
  duplicateSources,
}: ReferenceRowProps) {
  if (!isTextileLine(record.line)) return null;
  const line = record.line;

  // ── Derived model & colors ────────────────────────────────────────
  const model = useMemo(
    () => getTextileModel(line.modelId) ?? null,
    [line.modelId],
  );

  const usedColors = useMemo<TextileColor[]>(() => {
    if (!model) return [];
    const ids = new Set<string>();
    for (const it of Object.values(line.items)) {
      if (it.isPlaceholder) continue;
      if (it.qty <= 0) continue;
      ids.add(it.color);
    }
    return model.colors.filter((c) => ids.has(c.id));
  }, [line.items, model]);

  const drafts = line.batDrafts ?? {};
  const linked = line.linkedBats ?? {};

  const colorsWithBat = useMemo(() => {
    const set = new Set<string>();
    for (const id of Object.keys(drafts)) {
      if ((drafts[id]?.length ?? 0) > 0) set.add(id);
    }
    for (const id of Object.keys(linked)) set.add(id);
    return set;
  }, [drafts, linked]);

  // ── Aggregated state ─────────────────────────────────────────────
  const totalUsed = usedColors.length;
  const totalReady = usedColors.filter((c) => colorsWithBat.has(c.id)).length;
  const status: RowState =
    totalUsed > 0 && totalReady === totalUsed
      ? "validated"
      : totalReady === 0
        ? "none"
        : "in_progress";

  // ── Sizes / quantities compact summary ───────────────────────────
  const totals = computeTotals(line);

  const sizesCompact = useMemo(() => {
    if (!model) return "";
    const bySize = new Map<string, number>();
    for (const it of Object.values(line.items)) {
      if (it.isPlaceholder) continue;
      if (it.qty <= 0) continue;
      bySize.set(it.size, (bySize.get(it.size) ?? 0) + it.qty);
    }
    const ordered = model.sizes
      .map((s) => ({ label: s.label, qty: bySize.get(s.id) ?? 0 }))
      .filter((s) => s.qty > 0);
    return ordered.map((s) => `${s.label}·${s.qty}`).join("  /  ");
  }, [line.items, model]);

  // ── Last-modified micro-text ─────────────────────────────────────
  const lastModified = useMemo(() => {
    let latest: number | null = null;
    for (const id of Object.keys(drafts)) {
      const arr = drafts[id];
      if (!arr) continue;
      for (const v of arr) {
        const t = Date.parse(v.generatedAt);
        if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t;
      }
    }
    if (latest === null) return null;
    return formatRelative(latest);
  }, [drafts]);

  // ── Store & editor handles ───────────────────────────────────────
  const expandLineStore = useNewOrderStore((s) => s.expandLine);
  const resetLineBat = useNewOrderStore((s) => s.resetLineBat);
  const copyArtworkToLines = useNewOrderStore((s) => s.copyArtworkToLines);
  const openBatEditor = useBatEditor((s) => s.open);

  // Choose the colour to focus when opening the BAT generator. Pick the
  // first colour without BAT (so the user lands on actionable work);
  // fall back to the first color overall.
  const focusColorId = useMemo(() => {
    const todo = usedColors.find((c) => !colorsWithBat.has(c.id));
    return (todo ?? usedColors[0])?.id ?? null;
  }, [usedColors, colorsWithBat]);

  function openBatFor(colorId: string | null, grouped = false) {
    if (!colorId) return;
    // The studio drawer reads `selectLine` (= the expanded record).
    // Make sure this row is the one being edited before opening.
    expandLineStore(record.id);
    openBatEditor(colorId, { grouped });
  }

  function handleZone2Click() {
    openBatFor(focusColorId, status === "none" && totalUsed > 1);
  }

  // ── CTA spec ─────────────────────────────────────────────────────
  const cta = ctaForStatus(status);

  return (
    <article
      role="listitem"
      data-state={status}
      data-expanded={isExpanded || undefined}
      className={`group rounded-[12px] border bg-white shadow-sm transition-[box-shadow,border-color,transform] duration-150 ease-out ${
        isExpanded
          ? "border-blue-300 ring-2 ring-blue-100"
          : "border-slate-200 hover:-translate-y-px hover:border-slate-300 hover:shadow"
      }`}
    >
      <div className="flex flex-col md:flex-row">
        {/* ─────── Zone 1 — Récap commande ─────── */}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={`ref-row-panel-${record.id}`}
          aria-label={`Ouvrir le récap de la référence ${line.modelName}`}
          className="flex flex-1 items-center gap-3 rounded-l-[10px] px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:px-4 md:py-3"
        >
          <Thumbnail color={usedColors[0]} target={model?.target as ProductTarget ?? null} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                #{index + 1}
              </span>
              <h3 className="truncate text-[14px] font-semibold text-slate-800">
                {line.modelName || model?.name || "Textile"}
              </h3>
              {model?.reference && (
                <span className="flex-none rounded border border-[#ADB8B9] bg-transparent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#64748b]">
                  {model.reference}
                </span>
              )}
              <StatusBadge status={status} ready={totalReady} total={totalUsed} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-600">
              <ColorPills colors={usedColors} colorsWithBat={colorsWithBat} />
              {sizesCompact && (
                <span className="font-mono text-[11px] text-slate-500">
                  {sizesCompact}
                </span>
              )}
              {totals.totalQty > 0 && (
                <span className="text-slate-500">
                  {totals.totalQty} pièce{totals.totalQty > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="hidden flex-none flex-col items-end justify-center text-right sm:flex">
            <span className="text-[11px] text-slate-500">
              {totals.unitPrice > 0 ? (
                <><NumberRoller value={formatEUR(totals.unitPrice)} fontSize={11} className="font-mono tabular-nums" />/u</>
              ) : "—"}
            </span>
            <span className="text-[14px] font-bold text-slate-800">
              {totals.subtotal > 0 ? (
                <NumberRoller value={formatEUR(totals.subtotal)} fontSize={14} className="font-mono font-bold tabular-nums" />
              ) : "—"}
            </span>
          </div>

          <ChevronDown
            size={16}
            className={`flex-none text-slate-400 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {/* ─────── Zone 2 — Action BAT ─────── */}
        <Zone2
          status={status}
          cta={cta}
          totalReady={totalReady}
          totalUsed={totalUsed}
          lastModified={lastModified}
          onClick={handleZone2Click}
          onReset={() => {
            if (
              status !== "none" &&
              !window.confirm(
                "Réinitialiser le BAT de cette référence ? Toutes les versions seront supprimées.",
              )
            ) {
              return;
            }
            resetLineBat(record.id);
          }}
          duplicateSources={duplicateSources}
          onDuplicateFrom={(sourceId) => {
            copyArtworkToLines(sourceId, [record.id]);
          }}
          ariaLabel={`${cta.label} pour la référence ${line.modelName}`}
        />
      </div>

      {/* ─────── BAT par couleur ─────── */}
      {totalUsed > 0 && (
        <div
          id={`ref-row-panel-${record.id}`}
          className="rounded-b-[10px] border-t border-slate-100 bg-slate-50/60 p-4"
        >
          <ColorBatPanel
            line={line}
            usedColors={usedColors}
            onEditColor={(colorId) => openBatFor(colorId)}
          />
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Zone 2 — CTA + kebab
// ─────────────────────────────────────────────────────────────────────

interface Zone2Props {
  status: RowState;
  cta: { label: string; tone: "primary" | "amber" | "ok" | "muted"; icon: React.ReactNode };
  totalReady: number;
  totalUsed: number;
  lastModified: string | null;
  onClick: () => void;
  onReset: () => void;
  duplicateSources: OrderLineRecord[];
  onDuplicateFrom: (sourceId: string) => void;
  ariaLabel: string;
}

function Zone2({
  status,
  cta,
  totalReady,
  totalUsed,
  lastModified,
  onClick,
  onReset,
  duplicateSources,
  onDuplicateFrom,
  ariaLabel,
}: Zone2Props) {
  const microText = useMemo(() => {
    if (totalUsed === 0) return "Aucune couleur sélectionnée";
    const colorPart = `${totalUsed} couleur${totalUsed > 1 ? "s" : ""}`;
    if (status === "none") return colorPart;
    const readyPart = `${totalReady}/${totalUsed} prêt${totalReady > 1 ? "s" : ""}`;
    if (lastModified) return `${readyPart} · ${lastModified}`;
    return `${colorPart} · ${readyPart}`;
  }, [status, totalReady, totalUsed, lastModified]);

  const toneClass =
    cta.tone === "primary"
      ? "bg-[#4A6274] text-white hover:bg-[#3a4e5d]"
      : cta.tone === "amber"
        ? "bg-amber-500 text-white hover:bg-amber-600"
        : cta.tone === "ok"
          ? "border border-emerald-500 bg-white text-emerald-700 hover:bg-emerald-50"
          : "bg-slate-200 text-slate-700 hover:bg-slate-300";

  return (
    <div className="relative flex flex-none flex-col justify-center gap-1.5 rounded-r-[10px] border-l border-slate-100 bg-slate-900/[0.025] p-3 md:w-[220px]">
      <button
        type="button"
        data-action="bat"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-label={ariaLabel}
        disabled={totalUsed === 0}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
      >
        {cta.icon}
        {cta.label}
      </button>
      <p className="truncate text-center text-[10.5px] text-slate-500">
        {microText}
      </p>

      <KebabMenu
        status={status}
        onReset={onReset}
        duplicateSources={duplicateSources}
        onDuplicateFrom={onDuplicateFrom}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Kebab menu (skip / duplicate / reset)
// ─────────────────────────────────────────────────────────────────────

interface KebabMenuProps {
  status: RowState;
  onReset: () => void;
  duplicateSources: OrderLineRecord[];
  onDuplicateFrom: (sourceId: string) => void;
}

function KebabMenu({
  status,
  onReset,
  duplicateSources,
  onDuplicateFrom,
}: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [showDuplicateList, setShowDuplicateList] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowDuplicateList(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowDuplicateList(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const eligibleSources = duplicateSources;
  const canReset = status === "in_progress" || status === "validated";

  return (
    <div ref={wrapperRef} className="absolute right-1.5 top-1.5">
      <button
        type="button"
        data-action="kebab"
        aria-label="Plus d'options BAT"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setShowDuplicateList(false);
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <MoreVertical size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-30 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {!showDuplicateList ? (
            <ul className="py-1">
              <KebabItem
                icon={<Copy size={14} aria-hidden="true" />}
                label="Dupliquer depuis…"
                hint={
                  eligibleSources.length === 0
                    ? "Aucune autre référence avec un BAT."
                    : `${eligibleSources.length} source${
                        eligibleSources.length > 1 ? "s" : ""
                      } disponible${eligibleSources.length > 1 ? "s" : ""}`
                }
                disabled={eligibleSources.length === 0}
                trailing={<ChevronDown size={12} className="-rotate-90" />}
                onClick={() => setShowDuplicateList(true)}
              />
              {canReset && (
                <KebabItem
                  icon={<RotateCw size={14} aria-hidden="true" />}
                  label="Réinitialiser le BAT"
                  hint="Supprime tous les BAT de cette référence."
                  tone="danger"
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                />
              )}
            </ul>
          ) : (
            <DuplicateList
              sources={eligibleSources}
              onPick={(id) => {
                onDuplicateFrom(id);
                setOpen(false);
                setShowDuplicateList(false);
              }}
              onBack={() => setShowDuplicateList(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface KebabItemProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  trailing?: React.ReactNode;
}

function KebabItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
  tone = "default",
  trailing,
}: KebabItemProps) {
  const toneClass =
    tone === "danger"
      ? "text-rose-700 hover:bg-rose-50"
      : "text-slate-700 hover:bg-slate-100";
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={onClick}
        className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-[12.5px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:bg-slate-100 ${toneClass}`}
      >
        <span className="mt-0.5 text-slate-500">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          {hint && (
            <span className="mt-0.5 block text-[10.5px] font-normal text-slate-500">
              {hint}
            </span>
          )}
        </span>
        {trailing && (
          <span className="mt-0.5 text-slate-400">{trailing}</span>
        )}
      </button>
    </li>
  );
}

function DuplicateList({
  sources,
  onPick,
  onBack,
}: {
  sources: OrderLineRecord[];
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
      >
        <ChevronDown size={11} className="rotate-90" aria-hidden="true" />
        Dupliquer depuis
      </button>
      <ul className="max-h-56 overflow-auto py-1">
        {sources.map((r) => {
          const tLine = r.line as TextileLine;
          const model = getTextileModel(tLine.modelId);
          const drafts = tLine.batDrafts ?? {};
          const linked = tLine.linkedBats ?? {};
          const count =
            Object.keys(drafts).filter((k) => (drafts[k]?.length ?? 0) > 0)
              .length + Object.keys(linked).length;
          return (
            <li key={r.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => onPick(r.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-slate-700 hover:bg-slate-100"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {tLine.modelName || model?.name || "Textile"}
                  </div>
                  <div className="truncate text-[10.5px] text-slate-500">
                    {model?.reference ?? ""} · {count} BAT
                    {count > 1 ? "s" : ""}
                  </div>
                </div>
                <Copy size={12} className="text-slate-400" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Smaller pieces
// ─────────────────────────────────────────────────────────────────────

function Thumbnail({ color, target }: { color?: TextileColor; target: ProductTarget | null }) {
  if (color?.mockupUrl) {
    return (
      <div className="h-[60px] w-[60px] flex-none overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50">
        <img
          src={color.mockupUrl}
          alt={color.label}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="h-[60px] w-[60px] flex-none overflow-hidden rounded-[8px] border border-slate-200">
      <ProductIcon target={target} size={32} />
    </div>
  );
}

function ColorPills({
  colors,
  colorsWithBat,
}: {
  colors: TextileColor[];
  colorsWithBat: Set<string>;
}) {
  if (colors.length === 0) {
    return <span className="text-[11px] text-slate-400">Aucune couleur</span>;
  }
  const visible = colors.slice(0, 6);
  const overflow = colors.length - visible.length;
  return (
    <div className="flex items-center gap-1">
      {visible.map((c) => (
        <span
          key={c.id}
          title={`${c.label}${colorsWithBat.has(c.id) ? " · BAT prêt" : ""}`}
          className={`block h-4 w-4 rounded-full ${
            c.swatchBorder ? "ring-1 ring-slate-300" : ""
          } ${colorsWithBat.has(c.id) ? "outline outline-2 outline-emerald-400 outline-offset-1" : ""}`}
          style={{ backgroundColor: c.hex }}
          aria-label={c.label}
        />
      ))}
      {overflow > 0 && (
        <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  ready,
  total,
}: {
  status: RowState;
  ready: number;
  total: number;
}) {
  if (total === 0) return null;
  if (status === "validated") {
    return (
      <span className="inline-flex h-[18px] flex-none items-center gap-1 rounded-full bg-emerald-100 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-800">
        <Check size={10} aria-hidden="true" />
        Personnalisé
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-amber-100 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-800">
        BAT en cours · {ready}/{total}
      </span>
    );
  }
  return (
    <span className="inline-flex h-[18px] flex-none items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-800">
      <Sparkles size={10} aria-hidden="true" strokeWidth={2.2} />À personnaliser
    </span>
  );
}

function ColorBatPanel({
  line,
  usedColors,
  onEditColor,
}: {
  line: TextileLine;
  usedColors: TextileColor[];
  onEditColor: (colorId: string) => void;
}) {
  const drafts = line.batDrafts ?? {};
  const linked = line.linkedBats ?? {};
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          BAT par couleur
        </h4>
        <span className="text-[10.5px] text-slate-500">
          {usedColors.length} couleur{usedColors.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
        {usedColors.map((c) => {
          const versions = drafts[c.id] ?? [];
          const link = linked[c.id];
          const ready = versions.length > 0 || !!link;
          const stateLabel = link
            ? "Lié"
            : ready
              ? `v${versions[versions.length - 1]?.version ?? "—"}`
              : "À créer";
          return (
            <button
              key={c.id}
              type="button"
              data-action="bat-color"
              onClick={(e) => {
                e.stopPropagation();
                onEditColor(c.id);
              }}
              className={`group/c flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-left transition hover:-translate-y-px hover:shadow ${
                ready ? "border-emerald-200" : "border-slate-200"
              }`}
            >
              <span
                className={`block h-5 w-5 flex-none rounded-full ${
                  c.swatchBorder ? "ring-1 ring-slate-300" : ""
                }`}
                style={{ backgroundColor: c.hex }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-slate-800">
                  {c.label}
                </div>
                <div className="truncate text-[10.5px] text-slate-500">
                  {stateLabel}
                </div>
              </div>
              {ready ? (
                <Pencil
                  size={12}
                  className="text-slate-400 group-hover/c:text-blue-600"
                  aria-hidden="true"
                />
              ) : (
                <Plus
                  size={12}
                  className="text-blue-500 group-hover/c:text-blue-700"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────

function ctaForStatus(status: RowState): {
  label: string;
  tone: "primary" | "amber" | "ok" | "muted";
  icon: React.ReactNode;
} {
  switch (status) {
    case "none":
      return {
        label: "Créer le BAT",
        tone: "primary",
        icon: <Plus size={14} aria-hidden="true" />,
      };
    case "in_progress":
      return {
        label: "Reprendre",
        tone: "amber",
        icon: <Pencil size={14} aria-hidden="true" />,
      };
    case "validated":
      return {
        label: "Modifier",
        tone: "ok",
        icon: <Check size={14} aria-hidden="true" />,
      };
  }
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

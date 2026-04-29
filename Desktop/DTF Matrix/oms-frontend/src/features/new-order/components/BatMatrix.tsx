import { lazy, Suspense, useMemo, useState } from "react";
import { Layers, Wand2 } from "lucide-react";
import { getTextileModel } from "../runtimeCatalog";
import { selectHeader, selectLine, useNewOrderStore } from "../store";
import {
  isTextileLine,
  type BatDraft,
  type BatMode,
  type LinkedBatRef,
  type TextileColor,
  type TextileLine,
} from "../types";
import { useBatEditor } from "../useBatEditor";
import { BatPicker } from "./BatPicker";

const BatViewerDrawer = lazy(() =>
  import("@/features/studio-bat").then((m) => ({ default: m.BatViewerDrawer })),
);

interface BatMatrixProps {
  /** Called when user wants to add a side / new mockup before any BAT exists. */
  onAddDesign?: () => void;
}

export function BatMatrix({ onAddDesign }: BatMatrixProps) {
  const line = useNewOrderStore(selectLine);
  const header = useNewOrderStore(selectHeader);
  const clearVersions = useNewOrderStore((s) => s.clearBatVersionsForColor);
  const linkBatForColor = useNewOrderStore((s) => s.linkBatForColor);
  const unlinkBatForColor = useNewOrderStore((s) => s.unlinkBatForColor);

  const openBatEditor = useBatEditor((s) => s.open);
  const [viewColorId, setViewColorId] = useState<string | null>(null);

  if (!line || !isTextileLine(line)) return null;

  const mode: BatMode = line.batMode ?? "new";

  return (
    <>
      <BatMatrixInner
        line={line}
        clientId={header.clientId}
        mode={mode}
        onAddDesign={onAddDesign}
        onEdit={(colorId) => {
          setViewColorId(null);
          openBatEditor(colorId);
        }}
        onView={(colorId) => setViewColorId(colorId)}
        onClearVersions={clearVersions}
        onLinkBat={linkBatForColor}
        onUnlinkBat={unlinkBatForColor}
        onCreateAll={(firstColorId) => {
          setViewColorId(null);
          openBatEditor(firstColorId, { grouped: true });
        }}
      />
      {viewColorId !== null && (
        <Suspense fallback={null}>
          <BatViewerDrawer
            open
            colorId={viewColorId}
            onClose={() => setViewColorId(null)}
            onEdit={(id) => {
              setViewColorId(null);
              openBatEditor(id);
            }}
          />
        </Suspense>
      )}
    </>
  );
}

interface InnerProps {
  line: TextileLine;
  clientId: string | null;
  mode: BatMode;
  onAddDesign?: () => void;
  onEdit: (colorId: string) => void;
  onView: (colorId: string) => void;
  onClearVersions: (colorId: string) => void;
  onLinkBat: (colorId: string, ref: LinkedBatRef) => void;
  onUnlinkBat: (colorId: string) => void;
  onCreateAll: (firstColorId: string) => void;
}

function BatMatrixInner({
  line,
  clientId,
  mode,
  onAddDesign,
  onEdit,
  onView,
  onClearVersions,
  onLinkBat,
  onUnlinkBat,
  onCreateAll,
}: InnerProps) {
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

  if (!model) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
        Sélectionnez un modèle pour générer les BAT
      </div>
    );
  }

  if (usedColors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Aucune couleur sélectionnée
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Ajoutez au moins une couleur avec quantité à l'étape précédente —
          un BAT sera généré automatiquement par couleur.
        </p>
      </div>
    );
  }

  const totalVersions = Object.values(drafts).flat().length;
  const totalLinked = Object.keys(linked).length;
  const allColorsHaveSomething = usedColors.every((c) => {
    const v = drafts[c.id];
    return (v && v.length > 0) || !!linked[c.id];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-700">
          Bons à Tirer (BAT)
        </h3>
        <span className="text-[11px] text-slate-500">
          {usedColors.length} couleur{usedColors.length > 1 ? "s" : ""}
          {mode === "new" && totalVersions > 0 && (
            <> · {totalVersions} version{totalVersions > 1 ? "s" : ""}</>
          )}
          {mode === "reuse" && totalLinked > 0 && (
            <> · {totalLinked} lié{totalLinked > 1 ? "s" : ""}</>
          )}
        </span>
      </div>

      {/* Mode "new" — grid + bouton groupé */}
      {mode === "new" && (
        <>
          {usedColors.length > 1 && !allColorsHaveSomething && (
            <button
              type="button"
              onClick={() => onCreateAll(usedColors[0].id)}
              className="group flex w-full items-center justify-between rounded-xl border-2 border-dashed border-[#4A6274]/40 bg-[#4A6274]/5 px-4 py-3 text-left transition hover:border-[#4A6274]/60 hover:bg-[#4A6274]/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A6274] text-white">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#2d3f4d]">
                    Créer tous les BATs ({usedColors.length})
                  </div>
                  <div className="text-[11px] text-[#4A6274]">
                    Studio multi-onglets · copier le visuel d'une couleur à une autre
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-[#4A6274] group-hover:text-[#2d3f4d]">
                Ouvrir →
              </span>
            </button>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {usedColors.map((color) => {
              const versions = drafts[color.id] ?? [];
              const active = versions[versions.length - 1] ?? null;
              return (
                <BatCard
                  key={color.id}
                  model={model.name}
                  modelReference={model.reference}
                  color={color}
                  versions={versions}
                  active={active}
                  linked={null}
                  onEdit={() => onEdit(color.id)}
                  onView={() => onView(color.id)}
                  onClearVersions={() => onClearVersions(color.id)}
                />
              );
            })}
          </div>

          <div className="flex justify-end">
            {onAddDesign && (
              <button
                type="button"
                onClick={onAddDesign}
                className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
              >
                + autre design / vue
              </button>
            )}
          </div>
        </>
      )}

      {/* Mode "reuse" — picker par couleur */}
      {mode === "reuse" && (
        <div className="space-y-4">
          {usedColors.map((color) => (
            <BatPicker
              key={color.id}
              color={color}
              model={model}
              clientId={clientId}
              linked={linked[color.id] ?? null}
              onLink={(ref) => onLinkBat(color.id, ref)}
              onUnlink={() => onUnlinkBat(color.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BatCardProps {
  model: string;
  modelReference: string;
  color: TextileColor;
  versions: BatDraft[];
  active: BatDraft | null;
  linked: LinkedBatRef | null;
  onEdit: () => void;
  onView: () => void;
  onClearVersions: () => void;
}

function BatCard({
  model,
  modelReference,
  color,
  versions,
  active,
  linked,
  onEdit,
  onView,
  onClearVersions,
}: BatCardProps) {
  const ready = !!active;
  const warningCount = active?.composition.warnings?.length ?? 0;
  const status: BatRowStatus = linked
    ? "LINKED"
    : ready
      ? "VALIDATED"
      : "TO_CREATE";

  const borderClass =
    status === "VALIDATED"
      ? "border-emerald-300"
      : status === "LINKED"
        ? "border-blue-300"
        : "border-orange-200";

  return (
    <div
      className={`group flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition duration-150 ease-out hover:-translate-y-px hover:shadow-md ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`block h-7 w-7 flex-none rounded-full ${color.swatchBorder ? "ring-1 ring-slate-300" : ""}`}
            style={{ backgroundColor: color.hex }}
          />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-slate-800">
              {color.label}
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {model} · {modelReference}
            </div>
          </div>
        </div>
        <BatStatusBadge
          status={status}
          version={active?.version}
          linkedRef={linked?.sourceOrderReference}
          decidedAt={linked?.decidedAt}
        />
      </div>

      <div className="mt-3 min-h-[44px] text-[11px] leading-relaxed">
        {ready && (
          <div className="space-y-1">
            <div className="text-slate-700">
              <strong>{active!.composition.totalQuantity}</strong> pcs ·{" "}
              {active!.composition.sizesSummary || "—"}
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-1 text-amber-700">
                <span aria-hidden="true">⚠</span>
                <span>
                  {warningCount} champ{warningCount > 1 ? "s" : ""} fiche
                  produit incomplet{warningCount > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        )}
        {!ready && !linked && (
          <p className="text-slate-500">
            Pas encore de BAT généré pour cette couleur.
          </p>
        )}
        {linked && (
          <div className="space-y-0.5 text-slate-700">
            <div>
              Réutilisé depuis{" "}
              <span className="font-mono font-semibold">
                {linked.sourceOrderReference}
              </span>
            </div>
            <div className="text-slate-500">{linked.sourceClientName}</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg px-3 text-[12px] font-semibold transition active:scale-[0.97] ${
            ready
              ? "bg-[#4A6274] text-white hover:bg-[#3a4e5d]"
              : "bg-[#4A6274] text-white hover:bg-[#3a4e5d]"
          }`}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {ready ? `Modifier → v${active!.version + 1}` : "Créer le BAT"}
        </button>
        {ready && (
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.97]"
            aria-label="Aperçu du BAT"
            title="Aperçu du BAT"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
      </div>

      {versions.length > 1 && (
        <details className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
          <summary className="cursor-pointer select-none font-semibold text-slate-700">
            Historique ({versions.length} versions)
          </summary>
          <ul className="mt-1.5 space-y-1">
            {[...versions].reverse().map((v) => (
              <li
                key={`${v.colorId}-${v.version}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="font-mono text-slate-600">v{v.version}</span>
                <span className="flex-1 truncate text-slate-500">
                  {new Date(v.generatedAt).toLocaleString("fr-FR")}
                </span>
                <button
                  type="button"
                  onClick={onView}
                  className="text-slate-700 underline-offset-2 hover:underline"
                >
                  Aperçu
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onClearVersions}
            className="mt-1.5 text-[10px] text-rose-600 underline-offset-2 hover:underline"
          >
            Effacer l'historique
          </button>
        </details>
      )}
    </div>
  );
}

// ───────── Status badge ─────────

type BatRowStatus = "TO_CREATE" | "LINKED" | "VALIDATED";

interface BatStatusBadgeProps {
  status: BatRowStatus;
  version?: number;
  linkedRef?: string;
  decidedAt?: string | null;
}

/**
 * Harmonized status pill — consistent across BatCard and the picker so the
 * user sees the same colors / labels everywhere a BAT can sit.
 */
export function BatStatusBadge({
  status,
  version,
  linkedRef,
  decidedAt,
}: BatStatusBadgeProps) {
  if (status === "TO_CREATE") {
    return (
      <span className="inline-flex h-5 flex-none items-center rounded-full bg-orange-500 px-2 text-[10px] font-bold uppercase tracking-wider text-white">
        À créer
      </span>
    );
  }
  if (status === "LINKED") {
    return (
      <span
        className="inline-flex h-5 max-w-[140px] flex-none items-center gap-1 truncate rounded-full bg-[#4A6274] px-2 text-[10px] font-bold uppercase tracking-wider text-white"
        title={linkedRef ? `Lié à ${linkedRef}` : "Lié"}
      >
        Lié
        {linkedRef && (
          <span className="truncate font-mono normal-case">
            {linkedRef}
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 flex-none items-center gap-1 rounded-full bg-emerald-600 px-2 text-[10px] font-bold uppercase tracking-wider text-white"
      title={decidedAt ?? undefined}
    >
      Validé
      {version !== undefined && (
        <span className="font-mono normal-case">v{version}</span>
      )}
    </span>
  );
}

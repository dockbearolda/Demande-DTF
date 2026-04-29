import { useMemo, useState } from "react";
import { Download, Pencil, X } from "lucide-react";
import {
  getTextileModel,
  isTextileLine,
  selectLine,
  useNewOrderStore,
  type BatDraft,
  type TextileColor,
} from "@/features/new-order";
import { DrawerShell } from "./components/DrawerShell";

interface BatViewerDrawerProps {
  open: boolean;
  colorId: string | null;
  onClose: () => void;
  /** Ouvre l'éditeur sur la prochaine version pour cette couleur. */
  onEdit: (colorId: string) => void;
}

function downloadDraft(draft: BatDraft) {
  const binary = atob(draft.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = draft.pdfFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/** Lecture seule — affiche la dernière version d'un BAT pour une couleur, avec actions. */
export function BatViewerDrawer({
  open,
  colorId,
  onClose,
  onEdit,
}: BatViewerDrawerProps) {
  const line = useNewOrderStore(selectLine);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const { color, versions, active } = useMemo(() => {
    if (!line || !isTextileLine(line) || !colorId) {
      return { color: null as TextileColor | null, versions: [] as BatDraft[], active: null as BatDraft | null };
    }
    const model = getTextileModel(line.modelId);
    const c = model?.colors.find((cc) => cc.id === colorId) ?? null;
    const v = line.batDrafts?.[colorId] ?? [];
    return { color: c, versions: v, active: v[v.length - 1] ?? null };
  }, [line, colorId]);

  const displayed = useMemo(() => {
    if (selectedVersion == null) return active;
    return versions.find((v) => v.version === selectedVersion) ?? active;
  }, [selectedVersion, active, versions]);

  if (!open || !colorId) return null;

  return (
    <DrawerShell
      open={open}
      onRequestClose={onClose}
      ariaLabel={`BAT — ${color?.label ?? "couleur"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {color && (
            <span
              aria-hidden="true"
              className={`block h-7 w-7 flex-none rounded-full ${color.swatchBorder ? "ring-1 ring-slate-300" : ""}`}
              style={{ backgroundColor: color.hex }}
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {color?.label ?? "Couleur"} — BAT v{displayed?.version ?? "?"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {displayed
                ? new Date(displayed.generatedAt).toLocaleString("fr-FR")
                : "Aucune version"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {displayed && (
            <button
              type="button"
              onClick={() => downloadDraft(displayed)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              title="Télécharger le PDF"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(colorId)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            data-autofocus="true"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier → v{versions.length + 1}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
            title="Fermer (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* PDF preview */}
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {displayed ? (
            <iframe
              key={`${colorId}-${displayed.version}`}
              title={`BAT v${displayed.version} ${color?.label ?? ""}`}
              src={`data:application/pdf;base64,${displayed.pdfBase64}`}
              className="h-full w-full"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
              Aucun BAT enregistré pour cette couleur. Cliquez sur «&nbsp;Modifier&nbsp;» pour en créer un.
            </div>
          )}
        </div>

        {/* Sidebar — métadonnées + historique */}
        <aside className="hidden w-72 flex-none flex-col gap-3 lg:flex">
          {displayed && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Composition
              </div>
              <dl className="space-y-1.5 text-slate-700">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Modèle</dt>
                  <dd className="truncate font-medium">
                    {displayed.composition.productLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Total</dt>
                  <dd className="font-medium">
                    {displayed.composition.totalQuantity} pcs
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Tailles</dt>
                  <dd className="truncate font-medium">
                    {displayed.composition.sizesSummary || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Vues</dt>
                  <dd className="font-medium">
                    {displayed.composition.views.length}
                  </dd>
                </div>
              </dl>
              {displayed.composition.warnings &&
                displayed.composition.warnings.length > 0 && (
                  <div className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                    {displayed.composition.warnings.length} avertissement
                    {displayed.composition.warnings.length > 1 ? "s" : ""}
                  </div>
                )}
            </div>
          )}

          {versions.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Historique
              </div>
              <ul className="space-y-1">
                {[...versions].reverse().map((v) => {
                  const isSel = (displayed?.version ?? -1) === v.version;
                  return (
                    <li key={v.version}>
                      <button
                        type="button"
                        onClick={() => setSelectedVersion(v.version)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition ${
                          isSel
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="font-mono">v{v.version}</span>
                        <span
                          className={`flex-1 truncate text-right ${isSel ? "text-slate-200" : "text-slate-500"}`}
                        >
                          {new Date(v.generatedAt).toLocaleDateString("fr-FR")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </DrawerShell>
  );
}

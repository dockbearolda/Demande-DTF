import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, CopyCheck, X } from "lucide-react";
import {
  getTextileModel,
  isTextileLine,
  selectHeader,
  selectLine,
  useNewOrderStore,
  type TextileColor,
} from "@/features/new-order";
import { StudioBatStudio } from "./StudioBatStudio";
import { DrawerShell } from "./components/DrawerShell";
import { useStudioStore } from "./store";
import { VIEW_ORDER } from "./types";

interface StudioBatDrawerProps {
  open: boolean;
  /** Couleur en cours d'édition. */
  colorId: string | null;
  onClose: () => void;
  /** Si fourni, permet la navigation `[` / `]` entre couleurs sans fermer le drawer. */
  onChangeColor?: (colorId: string) => void;
  /**
   * Mode "Créer tous les BATs" — affiche un onglet par couleur et avance
   * automatiquement vers la couleur suivante non terminée après validation.
   */
  groupedMode?: boolean;
}

/**
 * Wrapper plein écran de StudioBatStudio. Préserve le contexte du wizard
 * (la commande reste sur /orders/new), gère raccourcis clavier et garde-fou
 * "modifications non sauvegardées".
 */
export function StudioBatDrawer({
  open,
  colorId,
  onClose,
  onChangeColor,
  groupedMode = false,
}: StudioBatDrawerProps) {
  const header = useNewOrderStore(selectHeader);
  const line = useNewOrderStore(selectLine);
  const [dirty, setDirty] = useState(false);
  const validateRef = useRef<(() => void) | null>(null);
  const actionsRef = useRef<{
    duplicateToColors: (targetColorIds: string[]) => Promise<number>;
  } | null>(null);

  // Couleurs utilisées de la ligne — pour la navigation [ / ].
  const usedColors = useMemo<TextileColor[]>(() => {
    if (!line || !isTextileLine(line)) return [];
    const model = getTextileModel(line.modelId);
    if (!model) return [];
    const ids = new Set<string>();
    for (const it of Object.values(line.items)) {
      if (it.isPlaceholder || it.qty <= 0) continue;
      ids.add(it.color);
    }
    return model.colors.filter((c) => ids.has(c.id));
  }, [line]);

  const activeColor = useMemo(
    () => usedColors.find((c) => c.id === colorId) ?? null,
    [usedColors, colorId],
  );

  // Garde-fou de fermeture si dirty.
  const requestClose = useCallback(() => {
    if (
      dirty &&
      !window.confirm("Annuler les modifications non sauvegardées ?")
    ) {
      return;
    }
    // Reset le studio pour repartir clean la prochaine fois.
    useStudioStore.getState().resetAll();
    setDirty(false);
    onClose();
  }, [dirty, onClose]);

  // Raccourcis : Cmd/Ctrl+Enter = valider ; [ / ] = couleur précédente / suivante.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        validateRef.current?.();
        return;
      }
      if (isTextInput) return;
      if (e.key === "[" || e.key === "]") {
        if (!onChangeColor || usedColors.length < 2 || !colorId) return;
        const idx = usedColors.findIndex((c) => c.id === colorId);
        if (idx < 0) return;
        const nextIdx =
          e.key === "]"
            ? (idx + 1) % usedColors.length
            : (idx - 1 + usedColors.length) % usedColors.length;
        e.preventDefault();
        onChangeColor(usedColors[nextIdx].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onChangeColor, usedColors, colorId]);

  /** Couleurs sans BAT v1 (utilisées pour avance auto en groupedMode). */
  const pendingColors = useMemo(() => {
    if (!line || !isTextileLine(line)) return [] as TextileColor[];
    return usedColors.filter(
      (c) => !line.batDrafts?.[c.id] || line.batDrafts[c.id].length === 0,
    );
  }, [line, usedColors]);

  /** Capture le state courant du studio (mockups + logos + sliders) et crée un
   *  BatDraft v(N+1) pour chaque couleur cible en réutilisant la même compo,
   *  avec un PDF regénéré pour intégrer la fiche de chaque couleur cible. */
  const copyToColors = useCallback(
    async (toColorIds: string[]) => {
      if (!actionsRef.current) return;
      const filtered = toColorIds.filter((id) => id !== colorId);
      if (filtered.length === 0) return;
      await actionsRef.current.duplicateToColors(filtered);
      // Reste sur la couleur source — l'utilisateur peut continuer à éditer
      // ou changer manuellement de couleur via les onglets.
    },
    [colorId],
  );

  if (!open) return null;
  if (!line || !isTextileLine(line) || !colorId) return null;

  const versions = line.batDrafts?.[colorId] ?? [];
  const editingVersion = versions.length + 1;
  /** Snapshot of the currently-editing studio views — used by the Copy menu. */
  const otherColors = usedColors.filter((c) => c.id !== colorId);

  return (
    <DrawerShell
      open={open}
      onRequestClose={requestClose}
      ariaLabel={`Éditeur BAT — ${activeColor?.label ?? "couleur"}`}
    >
      {/* Header bar du drawer */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {activeColor && (
            <span
              aria-hidden="true"
              className={`block h-7 w-7 flex-none rounded-full ${activeColor.swatchBorder ? "ring-1 ring-slate-300" : ""}`}
              style={{ backgroundColor: activeColor.hex }}
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {activeColor?.label ?? "Couleur"} — édition v{editingVersion}
              {usedColors.length > 1 && pendingColors.length > 0 && (
                <span
                  className={`ml-2 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wider ${
                    groupedMode
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  title={
                    groupedMode
                      ? "Avance auto vers la couleur suivante après validation"
                      : "Couleurs sans BAT validé — naviguez avec [ et ]"
                  }
                >
                  {pendingColors.length} couleur
                  {pendingColors.length > 1 ? "s" : ""} restante
                  {pendingColors.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-slate-500">
              {header.clientNom.trim() || "Client à renseigner"}
              {usedColors.length > 1 && (
                <span className="ml-2 hidden text-slate-400 sm:inline">
                  · ⌘+Entrée pour valider · [ / ] couleur précédente / suivante · Esc pour fermer
                </span>
              )}
              {usedColors.length <= 1 && (
                <span className="ml-2 hidden text-slate-400 sm:inline">
                  · ⌘+Entrée pour valider · Esc pour fermer
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {otherColors.length > 0 && (
            <CopyToColorMenu
              colors={otherColors}
              onCopy={copyToColors}
              hint="Copie le visuel courant vers une ou plusieurs autres couleurs"
            />
          )}
          <button
            type="button"
            onClick={() => validateRef.current?.()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            title="Valider (⌘+Entrée)"
            data-autofocus="true"
          >
            <Check className="h-3.5 w-3.5" />
            Valider v{editingVersion}
          </button>
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fermer"
            title="Fermer (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Multi-tab color picker (visible whenever there are 2+ colors). */}
      {usedColors.length > 1 && (
        <ColorTabs
          colors={usedColors}
          activeId={colorId}
          batDrafts={line.batDrafts ?? {}}
          onSelect={(id) => onChangeColor?.(id)}
        />
      )}

      {/* Studio plein écran (utilise tout l'espace restant) */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <StudioBatStudio
          orderId={undefined}
          backTo="/orders/new"
          preview={{
            reference: "Nouvelle commande",
            clientName: header.clientNom.trim() || "Client à renseigner",
          }}
          colorId={colorId}
          hideTopBar
          onAfterValidate={() => {
            setDirty(false);
            // Grouped flow — don't close: jump to the next color without a BAT
            // (or close if everyone has one).
            if (groupedMode) {
              // Recompute pending colors AFTER the just-validated one.
              const stillPending = usedColors.filter((c) => {
                if (c.id === colorId) return false;
                const v = line.batDrafts?.[c.id];
                return !v || v.length === 0;
              });
              if (stillPending.length > 0 && onChangeColor) {
                useStudioStore.getState().resetAll();
                onChangeColor(stillPending[0].id);
                return;
              }
            }
            useStudioStore.getState().resetAll();
            onClose();
          }}
          onDirtyChange={setDirty}
          validateRef={validateRef}
          actionsRef={actionsRef}
        />
      </div>
    </DrawerShell>
  );
}

interface ColorTabsProps {
  colors: TextileColor[];
  activeId: string;
  batDrafts: Record<string, unknown[]>;
  onSelect: (id: string) => void;
}

function ColorTabs({ colors, activeId, batDrafts, onSelect }: ColorTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-2">
      {colors.map((c) => {
        const hasBat = (batDrafts[c.id]?.length ?? 0) > 0;
        const isActive = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={isActive}
            className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              isActive
                ? "border-slate-900 bg-slate-900 text-white"
                : hasBat
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <span
              aria-hidden="true"
              className={`block h-3 w-3 flex-none rounded-full ${c.swatchBorder ? "ring-1 ring-slate-300" : ""}`}
              style={{ backgroundColor: c.hex }}
            />
            <span className="truncate">{c.label}</span>
            {hasBat && !isActive && <Check className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );
}

interface CopyToColorMenuProps {
  colors: TextileColor[];
  onCopy: (colorIds: string[]) => void | Promise<void>;
  hint: string;
}

function CopyToColorMenu({ colors, onCopy, hint }: CopyToColorMenuProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Reset la sélection à chaque ouverture pour éviter les états figés.
  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  // Si la couleur source change pendant que le menu est ouvert (ex: navigation
  // [/] ou clic dans ColorTabs), purge les ids absents de `colors` pour éviter
  // une sélection orpheline qui inclurait la nouvelle couleur source.
  useEffect(() => {
    const allowed = new Set(colors.map((c) => c.id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [colors]);

  const allSelected = colors.length > 0 && selected.size === colors.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(colors.map((c) => c.id)));

  const handleApply = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      await onCopy(Array.from(selected));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={hint}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <Copy className="h-3.5 w-3.5" />
        Copier vers…
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => !busy && setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-[61] mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Couleurs cibles
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <CopyCheck className="h-3 w-3" />
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <ul className="max-h-60 overflow-auto py-1">
              {colors.map((c) => {
                const isSel = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={isSel}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                        isSel
                          ? "bg-slate-900/5 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded border transition ${
                          isSel
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                        aria-hidden="true"
                      >
                        {isSel && <Check className="h-3 w-3" />}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`block h-4 w-4 flex-none rounded-full ${c.swatchBorder ? "ring-1 ring-slate-300" : ""}`}
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="truncate">{c.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={handleApply}
                disabled={selected.size === 0 || busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                {busy
                  ? "Duplication…"
                  : selected.size === 0
                    ? "Sélectionnez au moins une couleur"
                    : `Copier vers ${selected.size} couleur${selected.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Keep the imported VIEW_ORDER reachable so future copy-by-canvas logic can
// reuse it without re-importing in the closure.
void VIEW_ORDER;

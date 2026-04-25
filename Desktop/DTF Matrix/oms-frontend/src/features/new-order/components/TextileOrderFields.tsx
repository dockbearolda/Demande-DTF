import { useMemo } from "react";
import { TEXTILE_MODELS } from "../constants";
import { selectLine, useNewOrderStore } from "../store";
import { isTextileLine, type TextileLine, type Target } from "../types";
import { Section } from "./primitives";
import { SizeColorTable } from "./SizeColorTable";

interface Props {
  error?: string;
  onStudioBat?: () => void;
}

const TARGET_LABEL: Record<Target, string> = {
  HOMME: "Homme",
  FEMME: "Femme",
  ENFANT: "Enfant",
};

export function TextileOrderFields({ error, onStudioBat }: Props) {
  const line = useNewOrderStore(selectLine);
  const setModel = useNewOrderStore((s) => s.setTextileModel);
  const clearItems = useNewOrderStore((s) => s.clearTextileItems);

  if (!line || !isTextileLine(line)) return null;

  return (
    <Inner
      line={line}
      setModel={setModel}
      clearItems={clearItems}
      onStudioBat={onStudioBat}
      error={error}
    />
  );
}

function Inner({
  line,
  setModel,
  clearItems,
  onStudioBat,
  error,
}: {
  line: TextileLine;
  setModel: (id: string) => void;
  clearItems: () => void;
  onStudioBat?: () => void;
  error?: string;
}) {
  const currentModel = useMemo(
    () => TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null,
    [line.modelId],
  );

  const design = line.design;
  const hasDesign =
    !!design.front || !!design.back || !!design.sleeves || design.skipped;

  const hasItems = Object.values(line.items).some((it) => !it.isPlaceholder);

  return (
    <div className="space-y-6">
      <Section
        label="Référence produit"
        required
        error={error && error.includes("Modèle") ? error : undefined}
        hint="Le genre est déduit automatiquement"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEXTILE_MODELS.map((m) => {
            const selected = line.modelId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setModel(m.id)}
                aria-pressed={selected}
                className={`group relative flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-slate-800 bg-slate-800 text-white shadow-sm ring-1 ring-slate-900/10"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {m.name}
                  </span>
                  <span
                    className={`mt-0.5 text-[10px] font-medium uppercase tracking-wider ${
                      selected ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    {TARGET_LABEL[m.target]}
                  </span>
                </span>
                <span
                  className={`flex-none rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                    selected
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  }`}
                >
                  {m.reference}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {currentModel && (
        <Section
          label="Tailles & Quantités"
          required
          error={error && error.includes("taille") ? error : undefined}
          hint="Ajoutez autant de lignes que nécessaire"
        >
          <SizeColorTable
            sizes={currentModel.sizes}
            colors={currentModel.colors}
            items={line.items}
          />

          {hasItems && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={clearItems}
                className="text-xs font-medium text-slate-400 transition hover:text-rose-600"
              >
                Vider le tableau
              </button>
            </div>
          )}
        </Section>
      )}

      {currentModel && (
        <Section label="Studio BAT" hint="Face, dos, manches">
          <button
            type="button"
            onClick={onStudioBat}
            className={`group flex w-full items-center justify-between rounded-xl border-2 border-dashed p-4 text-left transition ${
              hasDesign
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  hasDesign
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                <BatIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {hasDesign ? "Design prêt" : "Lier un design BAT"}
                </div>
                <div className="text-xs text-slate-500">
                  {hasDesign
                    ? `${[design.front, design.back, design.sleeves].filter(Boolean).length} face(s) · `
                    : ""}
                  {hasDesign
                    ? "Modifier dans le Studio BAT"
                    : "Face · Dos · Manches — ou « je ferai plus tard »"}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">
              Ouvrir →
            </span>
          </button>
        </Section>
      )}
    </div>
  );
}

function BatIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

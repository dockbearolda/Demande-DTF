import { useEffect, useMemo, useState } from "react";
import { TEXTILE_MODELS } from "../constants";
import { selectLine, useNewOrderStore } from "../store";
import {
  isTextileLine,
  type TextileColor,
  type TextileLine,
} from "../types";
import { Section, SegmentedControl } from "./primitives";
import { SizeQuantityPicker } from "./SizeQuantityPicker";

interface Props {
  error?: string;
}

const MODEL_FAMILIES: { key: string; label: string; sub?: string }[] = [
  { key: "T-shirt ECO", label: "ECO", sub: "Entrée de gamme" },
  { key: "T-shirt Classic", label: "Classic", sub: "Standard" },
  { key: "Premium", label: "Premium", sub: "Haut de gamme" },
];

/**
 * Step 1 content for textile flow:
 *   Genre → Modèle → Couleurs → Tailles/Quantités
 *
 * Logo placement + Studio BAT have moved to Step 2 (Personnalisation).
 */
export function TextileOrderFields({ error }: Props) {
  const line = useNewOrderStore(selectLine);
  const setTarget = useNewOrderStore((s) => s.setTextileTarget);
  const setModel = useNewOrderStore((s) => s.setTextileModel);
  const removeItem = useNewOrderStore((s) => s.removeTextileItem);

  if (!line || !isTextileLine(line)) return null;

  return (
    <Inner
      line={line}
      setTarget={setTarget}
      setModel={setModel}
      removeItem={removeItem}
      error={error}
    />
  );
}

function Inner({
  line,
  setTarget,
  setModel,
  removeItem,
  error,
}: {
  line: TextileLine;
  setTarget: (t: "HOMME" | "FEMME") => void;
  setModel: (id: string) => void;
  removeItem: (id: string) => void;
  error?: string;
}) {
  const modelsForTarget = useMemo(
    () => TEXTILE_MODELS.filter((m) => m.target === line.target),
    [line.target],
  );

  const familyCards = useMemo(
    () =>
      MODEL_FAMILIES.map((fam) => ({
        ...fam,
        model: modelsForTarget.find((m) => m.name === fam.key) ?? null,
      })).filter((c) => c.model !== null),
    [modelsForTarget],
  );

  const currentModel = useMemo(
    () => TEXTILE_MODELS.find((m) => m.id === line.modelId) ?? null,
    [line.modelId],
  );

  // Default Homme on mount if target is somehow unset/ENFANT.
  useEffect(() => {
    if (line.target !== "HOMME" && line.target !== "FEMME") {
      setTarget("HOMME");
    }
  }, [line.target, setTarget]);

  // Active colors track which colors have an open section, even when their
  // qty rows have been emptied. Re-seeded when model changes.
  const [activeColors, setActiveColors] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const it of Object.values(line.items)) {
      if (!it.isPlaceholder) set.add(it.color);
    }
    return set;
  });

  useEffect(() => {
    const set = new Set<string>();
    for (const it of Object.values(line.items)) {
      if (!it.isPlaceholder) set.add(it.color);
    }
    setActiveColors(set);
    // intentionally only react to model change so user-toggled colors persist
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.modelId]);

  const toggleColor = (color: TextileColor) => {
    if (!currentModel) return;
    setActiveColors((prev) => {
      const next = new Set(prev);
      if (next.has(color.id)) {
        for (const it of Object.values(line.items)) {
          if (it.color === color.id) removeItem(it.id);
        }
        next.delete(color.id);
      } else {
        next.add(color.id);
      }
      return next;
    });
  };

  const removeColorFromPicker = (colorId: string) => {
    const color = currentModel?.colors.find((c) => c.id === colorId);
    if (color) toggleColor(color);
  };

  return (
    <div className="space-y-6">
      {/* Genre */}
      <Section label="Genre" hint="Sélectionne la coupe homme ou femme">
        <SegmentedControl
          ariaLabel="Genre"
          size="lg"
          value={line.target === "FEMME" ? "FEMME" : "HOMME"}
          onChange={(v) => setTarget(v as "HOMME" | "FEMME")}
          options={[
            { value: "HOMME", label: "Homme" },
            { value: "FEMME", label: "Femme" },
          ]}
        />
      </Section>

      {/* 3 model family cards — horizontal scroll on narrow viewports */}
      <Section
        label="Modèle"
        name="modele"
        required
        error={error && error.includes("Modèle") ? error : undefined}
      >
        <div
          role="radiogroup"
          aria-label="Modèle de textile"
          className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible"
        >
          {familyCards.map(({ key, label, sub, model }) => {
            if (!model) return null;
            const selected = line.modelId === model.id;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setModel(model.id)}
                aria-label={`Modèle ${label}${sub ? ` — ${sub}` : ""}, référence ${model.reference}`}
                className={`group relative flex min-w-[140px] flex-none snap-start flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 text-center transition active:scale-[0.97] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-w-0 sm:flex-1 ${
                  selected
                    ? "border-blue-700 bg-blue-50 text-blue-800 shadow-sm"
                    : "border-slate-300 bg-white text-slate-900 hover:border-slate-500 hover:bg-slate-50"
                }`}
              >
                <ShirtGlyph
                  className={`h-7 w-7 ${selected ? "text-blue-700" : "text-slate-700"}`}
                  aria-hidden="true"
                />
                <span className="mt-1 text-base font-bold leading-tight">{label}</span>
                {sub && (
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      selected ? "text-blue-700" : "text-slate-600"
                    }`}
                  >
                    {sub}
                  </span>
                )}
                <span
                  className={`mt-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                    selected
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {model.reference}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Color picker (multi-select swatches) */}
      {currentModel && (
        <Section
          label="Couleurs"
          name="couleurs"
          hint="Clique pour ouvrir une ligne de tailles par couleur"
        >
          <div
            role="group"
            aria-label="Couleurs disponibles — sélection multiple"
            className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          >
            {currentModel.colors.map((c) => {
              const active = activeColors.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleColor(c)}
                  aria-pressed={active}
                  aria-label={`Couleur ${c.label}${active ? " — sélectionnée" : ""}`}
                  // ≥ 44px tap zone: h-[60px] (swatch + label) at p-2.
                  className={`group flex min-h-[60px] flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition active:scale-[0.97] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    active
                      ? "border-blue-700 bg-blue-50"
                      : "border-slate-300 bg-white hover:border-slate-500"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative block h-9 w-9 rounded-full transition ${
                      c.swatchBorder ? "ring-1 ring-slate-300" : ""
                    } ${active ? "ring-2 ring-blue-700 ring-offset-2" : ""}`}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span
                    className={`truncate text-[11px] font-semibold ${
                      active ? "text-blue-800" : "text-slate-700"
                    }`}
                  >
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Sizes / quantities — row-based picker */}
      {currentModel && activeColors.size > 0 && (
        <Section
          label="Tailles & Quantités"
          required
          error={error && error.toLowerCase().includes("taille") ? error : undefined}
          hint="Ajoute une ligne par taille et ajuste la quantité"
        >
          <SizeQuantityPicker
            activeColors={activeColors}
            onRemoveColor={removeColorFromPicker}
          />
        </Section>
      )}
    </div>
  );
}

// ───────── Icons ─────────

function ShirtGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7l4-3 2 2h4l2-2 4 3-2 4-2-1v9H8v-9l-2 1z" />
    </svg>
  );
}

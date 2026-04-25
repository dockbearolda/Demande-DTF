import { useMemo } from "react";

export type LogoPlacement = "front-heart" | "front-center" | "back" | "front-back";

const PLACEMENT_OPTIONS = [
  {
    id: "front-heart" as const,
    label: "Avant (cœur)",
    description: "Logo petit cœur",
    surcharge: 0,
  },
  {
    id: "front-center" as const,
    label: "Avant (centre)",
    description: "Logo poitrine",
    surcharge: 1.5,
  },
  {
    id: "back" as const,
    label: "Arrière",
    description: "Logo dos complet",
    surcharge: 2.5,
  },
  {
    id: "front-back" as const,
    label: "Avant + Arrière",
    description: "Logo partout",
    surcharge: 3.5,
  },
];

function TshirtMockup({ placement }: { placement: LogoPlacement }) {
  return (
    <div className="flex h-20 w-16 flex-col items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-center text-[10px] font-semibold text-slate-600">
      {placement === "front-heart" && (
        <>
          <div className="mb-1 h-2 w-2 rounded-full bg-slate-400" />
          <span>Cœur</span>
        </>
      )}
      {placement === "front-center" && (
        <>
          <div className="mb-2 h-3 w-8 rounded bg-slate-400" />
          <span>Poitrine</span>
        </>
      )}
      {placement === "back" && (
        <>
          <div className="mb-2 h-4 w-10 rounded bg-slate-400" />
          <span>Dos</span>
        </>
      )}
      {placement === "front-back" && (
        <>
          <div className="mb-1 h-3 w-8 rounded bg-slate-400" />
          <span className="text-[8px]">Avant+Arrière</span>
          <div className="mt-1 h-3 w-8 rounded bg-slate-400" />
        </>
      )}
    </div>
  );
}

interface Props {
  selected: LogoPlacement | null;
  onChange: (placement: LogoPlacement) => void;
  basePrice: number;
}

export function LogoPlacementSelector({ selected, onChange, basePrice }: Props) {
  const priceInfo = useMemo(() => {
    if (!selected) return null;
    const option = PLACEMENT_OPTIONS.find((o) => o.id === selected);
    return option ? { ...option, totalPrice: basePrice + option.surcharge } : null;
  }, [selected, basePrice]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PLACEMENT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                isSelected
                  ? "border-blue-600 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <TshirtMockup placement={opt.id} />
              <div className="text-left">
                <div
                  className={`text-[11px] font-semibold ${
                    isSelected ? "text-blue-700" : "text-slate-700"
                  }`}
                >
                  {opt.label}
                </div>
                <div className="text-[10px] text-slate-500">{opt.description}</div>
                <div className="mt-1 text-[10px] font-bold text-slate-600">
                  +{opt.surcharge.toFixed(2)}€
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {priceInfo && (
        <div className="rounded-lg bg-indigo-50 p-3 text-[12px]">
          <div className="flex items-baseline justify-between">
            <span className="text-slate-600">Prix unitaire ajusté</span>
            <span className="font-bold text-indigo-700">
              {priceInfo.totalPrice.toFixed(2)}€
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-600">
            Base {basePrice.toFixed(2)}€ + {priceInfo.surcharge.toFixed(2)}€ surcharge
          </div>
        </div>
      )}
    </div>
  );
}

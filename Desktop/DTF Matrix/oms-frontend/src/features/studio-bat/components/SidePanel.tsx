import { useToast } from "@/components/Toast";
import { useStudioStore } from "../store";
import { ingestLogo, ingestMockup, IngestError } from "../ingest";
import { VIEW_LABELS } from "../types";
import { UploadSlot } from "./UploadSlot";

const MOCKUP_ACCEPT = "image/png,image/jpeg";
const LOGO_ACCEPT = "image/png,image/jpeg,image/svg+xml,application/pdf";

export function SidePanel() {
  const { show } = useToast();
  const activeView = useStudioStore((s) => s.activeView);
  const view = useStudioStore((s) => s.views[activeView]);
  const setMockup = useStudioStore((s) => s.setMockup);
  const setLogo = useStudioStore((s) => s.setLogo);
  const setPosition = useStudioStore((s) => s.setPosition);
  const setLogoWidth = useStudioStore((s) => s.setLogoWidth);

  async function handleMockup(file: File) {
    try {
      const asset = await ingestMockup(file);
      setMockup(activeView, asset);
    } catch (err) {
      show(err instanceof IngestError ? err.message : "Mockup : lecture impossible", "error");
    }
  }

  async function handleLogo(file: File) {
    try {
      const asset = await ingestLogo(file);
      setLogo(activeView, asset);
    } catch (err) {
      show(err instanceof IngestError ? err.message : "Logo : lecture impossible", "error");
    }
  }

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vue active
        </div>
        <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {VIEW_LABELS[activeView]}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fichiers
          </h3>
          <UploadSlot
            label="Mockup fournisseur"
            accept={MOCKUP_ACCEPT}
            fileName={view.mockup?.name ?? null}
            onFile={handleMockup}
            onClear={() => setMockup(activeView, null)}
            hint="PNG ou JPG"
          />
          <UploadSlot
            label="Logo client"
            accept={LOGO_ACCEPT}
            fileName={view.logo?.name ?? null}
            onFile={handleLogo}
            onClear={() => setLogo(activeView, null)}
            hint="PDF, PNG ou SVG"
          />
        </section>

        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Réglages du logo
          </h3>

          <Slider
            label="Taille"
            value={view.logoWidthPct}
            min={5}
            max={80}
            step={1}
            unit="%"
            onChange={(v) => setLogoWidth(activeView, v)}
          />
          <Slider
            label="Position X"
            value={view.positionXPct}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => setPosition(activeView, v, view.positionYPct)}
          />
          <Slider
            label="Position Y"
            value={view.positionYPct}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => setPosition(activeView, view.positionXPct, v)}
          />
        </section>
      </div>
    </aside>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-500">
          {value}
          {unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900 dark:bg-slate-800 dark:accent-slate-100"
      />
    </div>
  );
}

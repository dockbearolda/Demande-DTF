import { useRef } from "react";
import { Check, Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useStudioStore } from "../store";
import { ingestMockup, IngestError } from "../ingest";
import { VIEW_LABELS, VIEW_ORDER, type ViewId } from "../types";

const MOCKUP_ACCEPT = "image/png,image/jpeg";

export function ViewTabs() {
  const { show } = useToast();
  const activeView = useStudioStore((s) => s.activeView);
  const views = useStudioStore((s) => s.views);
  const setActiveView = useStudioStore((s) => s.setActiveView);
  const setMockup = useStudioStore((s) => s.setMockup);

  const inputRefs = useRef<Partial<Record<ViewId, HTMLInputElement | null>>>({});

  async function handleFile(viewId: ViewId, f: File) {
    try {
      const asset = await ingestMockup(f);
      setMockup(viewId, asset);
      setActiveView(viewId);
    } catch (err) {
      show(err instanceof IngestError ? err.message : "Mockup illisible", "error");
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
      {VIEW_ORDER.map((id) => {
        const active = id === activeView;
        const v = views[id];
        const hasMockup = v.mockup !== null;
        const hasLogo = v.logo !== null;
        return (
          <div key={id} className="relative">
            <button
              type="button"
              onClick={() => {
                if (hasMockup) {
                  setActiveView(id);
                } else {
                  inputRefs.current[id]?.click();
                }
              }}
              className={`group relative flex h-20 w-24 flex-col items-center justify-between rounded-xl border px-2 py-2 text-[11px] font-medium transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800">
                {hasMockup ? (
                  <img
                    src={v.mockup!.dataUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-contain ${
                      id === "sleeve_left" ? "-scale-x-100" : ""
                    }`}
                  />
                ) : (
                  <Plus className="h-5 w-5" strokeWidth={2} />
                )}
              </div>
              <span className="leading-tight">{VIEW_LABELS[id]}</span>
              {hasLogo && (
                <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
            <input
              ref={(el) => {
                inputRefs.current[id] = el;
              }}
              type="file"
              accept={MOCKUP_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(id, f);
                e.target.value = "";
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

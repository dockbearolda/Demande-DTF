import { Check } from "lucide-react";
import { useStudioStore } from "../store";
import { VIEW_LABELS, VIEW_ORDER } from "../types";

export function ViewTabs() {
  const activeView = useStudioStore((s) => s.activeView);
  const views = useStudioStore((s) => s.views);
  const setActiveView = useStudioStore((s) => s.setActiveView);

  return (
    <div className="flex items-center justify-center gap-2 border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
      {VIEW_ORDER.map((id) => {
        const active = id === activeView;
        const hasMockup = views[id].mockup !== null;
        const hasLogo = views[id].logo !== null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            className={`group relative flex h-20 w-24 flex-col items-center justify-between rounded-xl border px-2 py-2 text-[11px] font-medium transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800">
              {hasMockup ? (
                <div className="h-full w-full rounded-md bg-slate-300 dark:bg-slate-700" />
              ) : (
                <span className="text-[9px] uppercase tracking-wide">vide</span>
              )}
            </div>
            <span className="leading-tight">{VIEW_LABELS[id]}</span>
            {hasLogo && (
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

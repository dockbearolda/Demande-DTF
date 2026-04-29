import { ArrowLeft, FileDown, SkipForward } from "lucide-react";
import { Link } from "react-router-dom";
import type { Order } from "@/lib/types";

interface TopBarProps {
  order: Order | undefined;
  reference?: string;
  clientName?: string;
  backTo: string;
  backLabel?: string;
  onSkip: () => void;
  skipLabel?: string;
  onGenerate: () => void;
  isGenerating?: boolean;
  generateDisabled?: boolean;
  generateDisabledHint?: string;
  generateLabel?: string;
  generatePendingLabel?: string;
  previewBadge?: string;
}

export function TopBar({
  order,
  reference,
  clientName,
  backTo,
  backLabel = "Retour",
  onSkip,
  skipLabel = "Ignorer",
  onGenerate,
  isGenerating,
  generateDisabled,
  generateDisabledHint,
  generateLabel = "Générer le BAT HD",
  generatePendingLabel = "Génération…",
  previewBadge,
}: TopBarProps) {
  const displayRef = reference ?? order?.reference ?? "—";
  const displayClient = clientName ?? order?.client?.nom ?? "Client —";
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-4 min-w-0">
        <Link
          to={backTo}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title={backLabel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {displayRef}
            </div>
            {previewBadge && (
              <span className="inline-flex flex-none items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                {previewBadge}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-slate-500">{displayClient}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <SkipForward className="h-3.5 w-3.5" />
          {skipLabel}
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || generateDisabled}
          title={generateDisabled ? generateDisabledHint : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <FileDown className="h-3.5 w-3.5" />
          {isGenerating ? generatePendingLabel : generateLabel}
        </button>
      </div>
    </header>
  );
}

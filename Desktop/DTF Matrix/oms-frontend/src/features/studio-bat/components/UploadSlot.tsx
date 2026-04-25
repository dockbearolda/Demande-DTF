import { useRef } from "react";
import { Upload, X } from "lucide-react";

interface UploadSlotProps {
  label: string;
  accept: string;
  fileName: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  hint?: string;
}

export function UploadSlot({ label, accept, fileName, onFile, onClear, hint }: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {fileName && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            Retirer
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-3 text-left transition hover:border-slate-400 hover:bg-slate-100/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
          {fileName ? <X className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
            {fileName ?? "Choisir un fichier"}
          </span>
          {hint && (
            <span className="block truncate text-[11px] text-slate-400">
              {hint}
            </span>
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

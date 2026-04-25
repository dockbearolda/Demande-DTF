import { useEffect, useRef, useState } from "react";

interface BatPreviewModalProps {
  file: File;
  recipient?: string;
  message?: string;
  expiresInDays?: number;
  sending?: boolean;
  onReplace: () => void;
  onSend: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BatPreviewModal({
  file,
  recipient,
  message,
  expiresInDays = 7,
  sending = false,
  onReplace,
  onSend,
}: BatPreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string>("");
  const isPdf = file.type === "application/pdf";
  const prevFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (prevFileRef.current === file) return;
    prevFileRef.current = file;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onReplace();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReplace, sending]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du BAT"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(18,22,26,0.92)", backdropFilter: "blur(8px)" }}
    >
      <header
        className="flex h-14 shrink-0 items-center justify-between px-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "white" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Aperçu du BAT</span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}
          >
            {file.name} · {formatSize(file.size)} · validité {expiresInDays}j
          </span>
        </div>
        <button
          type="button"
          onClick={onReplace}
          disabled={sending}
          aria-label="Fermer"
          className="rounded-md p-1.5 disabled:opacity-50"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        {objectUrl && (
          isPdf ? (
            <object
              data={objectUrl}
              type="application/pdf"
              className="h-full w-full rounded-lg"
              style={{ minHeight: "60vh", maxWidth: 900 }}
            >
              <p style={{ color: "rgba(255,255,255,0.7)" }} className="text-sm text-center">
                PDF : {file.name}
              </p>
            </object>
          ) : (
            <img
              src={objectUrl}
              alt="Aperçu du BAT"
              className="max-h-full max-w-full rounded-lg bg-white shadow-2xl"
            />
          )
        )}
      </div>

      <footer
        className="flex shrink-0 flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(18,22,26,0.6)", color: "#cbd5e1" }}
      >
        <div className="space-y-0.5">
          {recipient ? (
            <div>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Destinataire : </span>
              <span className="font-medium" style={{ color: "white" }}>{recipient}</span>
            </div>
          ) : (
            <div style={{ color: "var(--color-urgent-text, #fbbf24)" }}>Aucun email destinataire renseigné</div>
          )}
          {message ? (
            <div className="truncate text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>« {message} »</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReplace}
            disabled={sending}
            className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
          >
            Remplacer le fichier
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}
          >
            {sending ? "Envoi…" : "Envoyer au client"}
          </button>
        </div>
      </footer>
    </div>
  );
}

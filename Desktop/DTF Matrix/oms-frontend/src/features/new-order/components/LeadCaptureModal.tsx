import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPhoneNumber } from "@/lib/utils";

interface Props {
  open: boolean;
  initialName?: string;
  initialPhone?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (payload: { name: string; phone: string }) => void;
}

export function LeadCaptureModal({
  open,
  initialName = "",
  initialPhone = "",
  title = "Informations client",
  subtitle = "Nécessaires pour générer le devis",
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setPhone(initialPhone);
      setErrors({});
      const t = setTimeout(() => nameRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, initialName, initialPhone]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Nom requis";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) next.phone = "Numéro invalide";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({ name: name.trim(), phone: phone.trim() });
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
      />

      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-0 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-8 pt-7 pb-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-8 py-6">
          <Field
            label="Nom du client ou de l'entreprise"
            required
            error={errors.name}
          >
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Boutique Atelier 97"
              aria-invalid={!!errors.name || undefined}
              className={`block h-14 w-full rounded-xl border bg-white px-4 text-lg font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4 ${
                errors.name
                  ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                  : "border-slate-200 focus:border-slate-500 focus:ring-slate-100"
              }`}
            />
          </Field>

          <Field label="Numéro de téléphone" required error={errors.phone}>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="06 90 12 34 56"
              aria-invalid={!!errors.phone || undefined}
              className={`block h-14 w-full rounded-xl border bg-white px-4 text-lg font-medium tabular-nums text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4 ${
                errors.phone
                  ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                  : "border-slate-200 focus:border-slate-500 focus:ring-slate-100"
              }`}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-8 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Retour
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Continuer vers le devis
            <ArrowIcon className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {error && (
          <span className="text-[11px] font-medium text-rose-500">· {error}</span>
        )}
      </label>
      {children}
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

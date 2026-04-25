import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { BatPreviewModal } from "@/components/BatPreviewModal";
import { useBatsForOrder, useUploadBat } from "@/hooks/useBats";
import { useOrders } from "@/hooks/useOrders";
import type { BAT, BatStatus } from "@/lib/types";
import { AxiosError } from "axios";

const ACCEPT = "image/png,image/jpeg,image/svg+xml,application/pdf";
const MAX_MB = 20;

const BAT_STATUS_LABELS: Record<BatStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Validé",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
};

const BAT_STATUS_STYLES: Record<BatStatus, React.CSSProperties> = {
  PENDING: {
    background: "var(--status-bat-bg, #fef3c7)",
    color: "var(--status-bat-text, #92400e)",
    outline: "1px solid var(--status-bat-border, #fbbf24)",
  },
  APPROVED: {
    background: "var(--status-delivered-bg, #dcfce7)",
    color: "var(--status-delivered-text, #15803d)",
    outline: "1px solid var(--status-delivered-border, #86efac)",
  },
  REJECTED: {
    background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
    color: "var(--color-danger)",
    outline: "1px solid var(--color-danger)",
  },
  EXPIRED: {
    background: "var(--brand-paper-hi)",
    color: "var(--fg-3)",
    outline: "1px solid var(--brand-sage-100)",
  },
};

const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--brand-sage-100)",
  background: "var(--brand-paper)",
  color: "var(--fg-1)",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function BatStatusBadge({ status }: { status: BatStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={BAT_STATUS_STYLES[status]}
    >
      {BAT_STATUS_LABELS[status]}
    </span>
  );
}

type Step = "form" | "preview";

export function BatPage() {
  const { data: orders = [] } = useOrders({ limit: 200 });
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<Step>("form");

  const uploadMut = useUploadBat();
  const { show } = useToast();
  const { data: bats = [], isLoading: batsLoading } =
    useBatsForOrder(selectedOrderId || undefined);

  const orderOptions = useMemo(
    () =>
      orders
        .slice()
        .sort((a, b) => a.reference.localeCompare(b.reference))
        .map((o) => ({ id: o.id, reference: o.reference })),
    [orders],
  );

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const recipient = selectedOrder?.client?.email ?? undefined;

  function handleFileChange(f: File | null) {
    setFileError("");
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`Fichier trop volumineux (max ${MAX_MB} Mo)`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function onPreview(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrderId) { show("Sélectionnez une commande", "error"); return; }
    if (!file) { show("Sélectionnez un fichier", "error"); return; }
    setStep("preview");
  }

  async function onSend() {
    if (!selectedOrderId || !file) return;
    try {
      await uploadMut.mutateAsync({
        order_id: selectedOrderId,
        file,
        message: message.trim() || undefined,
      });
      show("BAT envoyé au client", "success");
      setFile(null);
      setMessage("");
      setStep("form");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const detail = axiosErr.response?.data?.detail ?? "Upload impossible";
      show(`Erreur : ${detail}`, "error");
      setStep("form");
    }
  }

  const TH_STYLE: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    borderBottom: "1px solid var(--brand-sage-100)",
    background: "var(--brand-paper-hi)",
    color: "var(--fg-3)",
  };

  return (
    <>
      {step === "preview" && file ? (
        <BatPreviewModal
          file={file}
          recipient={recipient}
          message={message || undefined}
          sending={uploadMut.isPending}
          onReplace={() => setStep("form")}
          onSend={onSend}
        />
      ) : null}

      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--fg-1)" }}>
              BAT — Bon à tirer
            </h1>
            <p className="text-sm" style={{ color: "var(--fg-3)" }}>
              Uploadez un PDF ou une image — vous pourrez le prévisualiser avant envoi.
            </p>
          </div>
          <Link
            to={selectedOrderId ? `/studio-bat/${selectedOrderId}` : "#"}
            onClick={(e) => {
              if (!selectedOrderId) {
                e.preventDefault();
                show("Sélectionnez d'abord une commande", "error");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
            style={
              selectedOrderId
                ? { background: "var(--fg-1)", color: "var(--brand-paper)" }
                : { background: "var(--brand-sage-100)", color: "var(--fg-3)", cursor: "not-allowed" }
            }
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4l4 4-8 8h-4v-4l8-8z"/><path d="M4 20h16"/></svg>
            Composer dans Studio BAT →
          </Link>
        </header>

        <form
          onSubmit={onPreview}
          className="grid grid-cols-1 gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{
            background: "var(--brand-paper)",
            border: "1px solid var(--brand-sage-100)",
            boxShadow: "var(--shadow-1)",
          }}
          aria-label="Envoyer un BAT"
        >
          <label className="text-xs font-medium" style={{ color: "var(--fg-3)" }}>
            Commande
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
              style={INPUT_STYLE}
            >
              <option value="">—</option>
              {orderOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.reference}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium" style={{ color: "var(--fg-3)" }}>
            Fichier (PDF, PNG, JPG, SVG — max {MAX_MB} Mo)
            <input
              id="bat-file-input"
              type="file"
              accept={ACCEPT}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              required
              className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
              style={INPUT_STYLE}
            />
            {fileError ? (
              <span className="mt-1 block text-xs" style={{ color: "var(--color-danger)" }}>{fileError}</span>
            ) : null}
          </label>

          <label className="text-xs font-medium sm:col-span-2" style={{ color: "var(--fg-3)" }}>
            Message (optionnel)
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 block w-full rounded-md px-2 py-1.5 text-sm"
              style={INPUT_STYLE}
            />
          </label>

          <div className="lg:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={!file || !selectedOrderId}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}
            >
              Prévisualiser le BAT →
            </button>
          </div>
        </form>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg-1)" }}>
            BATs de la commande sélectionnée
          </h2>
          <div
            className="overflow-hidden rounded-xl"
            style={{
              background: "var(--brand-paper)",
              border: "1px solid var(--brand-sage-100)",
              boxShadow: "var(--shadow-1)",
            }}
          >
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    {["Fichier", "Statut", "Créé", "Expire"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                        style={TH_STYLE}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!selectedOrderId ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                        Sélectionnez une commande pour voir ses BATs
                      </td>
                    </tr>
                  ) : batsLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                        Chargement…
                      </td>
                    </tr>
                  ) : bats.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--fg-3)" }}>
                        Aucun BAT pour cette commande
                      </td>
                    </tr>
                  ) : (
                    bats.map((b: BAT, i: number) => (
                      <tr
                        key={b.id}
                        style={{
                          background: i % 2 === 0 ? "var(--brand-paper)" : "var(--brand-paper-hi)",
                        }}
                      >
                        <td
                          className="px-3 py-2"
                          style={{ borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-1)" }}
                        >
                          <div className="font-medium">{b.file_name}</div>
                          {b.message ? (
                            <div className="text-xs" style={{ color: "var(--fg-3)" }}>{b.message}</div>
                          ) : null}
                        </td>
                        <td
                          className="px-3 py-2"
                          style={{ borderBottom: "1px solid var(--brand-sage-100)" }}
                        >
                          <BatStatusBadge status={b.status} />
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums"
                          style={{ borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-2)" }}
                        >
                          {formatDateTime(b.created_at)}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums"
                          style={{ borderBottom: "1px solid var(--brand-sage-100)", color: "var(--fg-2)" }}
                        >
                          {formatDateTime(b.expires_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

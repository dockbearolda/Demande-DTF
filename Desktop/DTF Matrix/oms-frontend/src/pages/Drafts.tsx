import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useDeleteDraft, useDrafts, type DraftRead } from "@/hooks/useDrafts";
import { useNewOrderStore, type WizardStep } from "@/features/new-order/store";
import { setQuoteId } from "@/features/new-order/quoteId";
import type { OrderDraft } from "@/features/new-order/types";
import { logger } from "@/lib/logger";

/** Page « Commandes → Brouillons ». Liste tous les devis non finalisés et
 *  permet de les reprendre (rehydrate du store + redirection vers le tunnel)
 *  ou de les supprimer. */
export function DraftsPage() {
  const navigate = useNavigate();
  const { data: drafts = [], isLoading, error } = useDrafts();
  const deleteDraft = useDeleteDraft();
  const hydrateFromDraft = useNewOrderStore((s) => s.hydrateFromDraft);
  const [resumingId, setResumingId] = useState<string | null>(null);

  const handleResume = async (id: string) => {
    setResumingId(id);
    try {
      const res = await api.get<DraftRead>(`/drafts/${id}`);
      const payload = res.data.payload as {
        draft?: OrderDraft;
        currentStep?: WizardStep;
      };
      if (!payload?.draft || !payload?.currentStep) {
        throw new Error("Brouillon corrompu");
      }
      hydrateFromDraft({
        draft: payload.draft,
        currentStep: payload.currentStep,
        draftId: id,
      });
      if (res.data.quote_id) setQuoteId(res.data.quote_id);
      navigate("/orders/new");
    } catch (err) {
      logger.warn("Resume draft failed", err);
      setResumingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--fg-1)",
            letterSpacing: "-0.01em",
          }}
        >
          Brouillons
        </h1>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: "var(--font-text)",
            fontSize: 13,
            color: "var(--fg-3)",
          }}
        >
          Devis sauvegardés automatiquement — reprends-les là où tu t'es arrêté.
        </p>
      </header>

      {isLoading && <SkeletonList />}
      {error && (
        <div
          role="alert"
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(220, 38, 38, 0.06)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            color: "#7f1d1d",
            fontSize: 13,
          }}
        >
          Échec du chargement des brouillons. Vérifie ta connexion et recharge.
        </div>
      )}

      {!isLoading && !error && drafts.length === 0 && <EmptyState />}

      {drafts.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {drafts.map((d) => (
            <li
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid rgba(74, 98, 116, 0.1)",
                boxShadow: "0 1px 2px rgba(74, 98, 116, 0.04)",
              }}
            >
              <FileText
                size={20}
                strokeWidth={1.75}
                style={{ color: "var(--brand-duck-500, #4A6274)", flexShrink: 0 }}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--fg-2)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {d.quote_id ?? "Devis"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-text)",
                      fontSize: 14,
                      fontWeight: 600,
                      color: d.client_name ? "var(--fg-1)" : "var(--fg-4)",
                    }}
                  >
                    {d.client_name ?? "Client à définir"}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: "var(--font-text)",
                    fontSize: 12,
                    color: "var(--fg-3)",
                  }}
                >
                  {summarize(d.reference_count, d.item_count, d.last_step)} ·
                  {" "}
                  {formatRelative(d.updated_at)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteDraft.mutate(d.id)}
                disabled={deleteDraft.isPending}
                aria-label={`Supprimer ${d.quote_id ?? d.id}`}
                title="Supprimer"
                style={{
                  height: 36,
                  width: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  border: "1px solid rgba(74, 98, 116, 0.14)",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={() => handleResume(d.id)}
                disabled={resumingId === d.id}
                style={{
                  height: 36,
                  padding: "0 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 8,
                  border: "none",
                  background: "#4A6274",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-text)",
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: resumingId === d.id ? 0.6 : 1,
                }}
              >
                Reprendre
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STEP_LABEL: Record<number, string> = {
  1: "Client",
  2: "Articles",
  3: "Personnalisation",
  4: "Livraison",
};

function summarize(
  referenceCount: number,
  itemCount: number,
  lastStep: number,
): string {
  const refs =
    referenceCount > 0
      ? `${referenceCount} référence${referenceCount > 1 ? "s" : ""}`
      : "Aucune référence";
  const qty = itemCount > 0 ? ` · ${itemCount} pcs` : "";
  const step = STEP_LABEL[lastStep] ?? `Étape ${lastStep}`;
  return `${refs}${qty} · arrêt à ${step}`;
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "40px 24px",
        borderRadius: 16,
        border: "2px dashed rgba(74, 98, 116, 0.18)",
        background: "rgba(255, 255, 255, 0.4)",
        textAlign: "center",
        color: "var(--fg-3)",
      }}
    >
      <FileText
        size={32}
        strokeWidth={1.5}
        style={{ color: "var(--fg-4)", marginBottom: 8 }}
        aria-hidden="true"
      />
      <div
        style={{
          fontFamily: "var(--font-text)",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--fg-2)",
          marginBottom: 4,
        }}
      >
        Aucun brouillon
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: "var(--fg-3)",
          lineHeight: 1.55,
        }}
      >
        Tes devis en cours apparaissent ici dès que tu commences à les saisir.
      </p>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          style={{
            height: 70,
            borderRadius: 12,
            background: "rgba(74, 98, 116, 0.05)",
            border: "1px solid rgba(74, 98, 116, 0.08)",
          }}
        />
      ))}
    </ul>
  );
}

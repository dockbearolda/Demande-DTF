import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  computeTotals,
  useFlashQuoteStore,
  type FlashQuoteState,
} from "../store";
import { downloadPdf, generateQuotePdf } from "../lib/pdf";
import { logger } from "@/lib/logger";

interface Props {
  open: boolean;
  onClose: () => void;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function EmailSendModal({ open, onClose }: Props) {
  const client = useFlashQuoteStore((s: FlashQuoteState) => s.client);
  const lines = useFlashQuoteStore((s) => s.lines);
  const discount = useFlashQuoteStore((s) => s.discount);
  const vatRate = useFlashQuoteStore((s) => s.vatRate);
  const quoteNumber = useFlashQuoteStore((s) => s.quoteNumber);
  const emittedAt = useFlashQuoteStore((s) => s.emittedAt);
  const validUntil = useFlashQuoteStore((s) => s.validUntil);
  const notes = useFlashQuoteStore((s) => s.notes);
  const toast = useToast();

  const [to, setTo] = useState(client.email);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    const totals = computeTotals({ lines, discount, vatRate });
    const ref = quoteNumber ?? "—";
    setTo(client.email || "");
    setSubject(`Devis ${ref} — ${fmtMoney(totals.totalTTC)} TTC`);
    setBody(
      [
        `Bonjour${client.nom ? " " + client.nom : ""},`,
        ``,
        `Veuillez trouver en pièce jointe le devis ${ref} d'un montant de ${fmtMoney(totals.totalTTC)} TTC.`,
        `Ce devis est valable jusqu'au ${validUntil}.`,
        ``,
        `Pour toute question, n'hésitez pas à nous contacter.`,
        ``,
        `Cordialement,`,
      ].join("\n"),
    );
  }, [open, client.email, client.nom, lines, discount, vatRate, quoteNumber, validUntil]);

  if (!open) return null;

  const handleSend = async () => {
    if (!to.trim() || !/.+@.+\..+/.test(to)) {
      toast.show("Email destinataire invalide", "error");
      return;
    }
    try {
      const ref = quoteNumber ?? "DEVIS";
      const bytes = await generateQuotePdf({
        quoteNumber: ref,
        emittedAt,
        validUntil,
        client,
        lines,
        discount,
        vatRate,
        notes,
      });
      downloadPdf(bytes, `${ref}.pdf`);
      // Open default mail client; user attaches the downloaded PDF.
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      toast.show("PDF téléchargé — joignez-le à votre email", "success");
      onClose();
    } catch (err) {
      toast.show("Erreur de génération du PDF", "error");
      logger.error(err);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flash-email-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15,20,24,0.42)",
        backdropFilter: "blur(2px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 92vw)",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "var(--shadow-3)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            id="flash-email-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink-900)",
              fontFamily: "var(--font-display)",
            }}
          >
            Envoyer le devis par email
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-500)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <Field label="Destinataire">
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="client@exemple.fr"
            style={inputStyle}
          />
        </Field>

        <Field label="Objet">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            style={{ ...inputStyle, height: "auto", padding: 10, resize: "vertical" }}
          />
        </Field>

        <div
          style={{
            background: "var(--ink-50)",
            border: "1px solid var(--ink-200)",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: "var(--ink-600)",
            lineHeight: 1.5,
          }}
        >
          Le PDF sera téléchargé sur votre poste, puis votre client mail s'ouvrira.
          Joignez le fichier téléchargé avant d'envoyer.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--ink-200)",
              color: "var(--ink-700)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            style={{
              height: 38,
              padding: "0 16px",
              borderRadius: 8,
              background: "var(--accent-500)",
              border: "none",
              color: "var(--fg-on-primary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "var(--shadow-1)",
            }}
          >
            Télécharger PDF + Ouvrir email
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-500)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  border: "1px solid var(--ink-200)",
  borderRadius: 8,
  background: "#fff",
  fontSize: 13,
  color: "var(--ink-900)",
  outline: "none",
  fontFamily: "var(--font-text)",
};

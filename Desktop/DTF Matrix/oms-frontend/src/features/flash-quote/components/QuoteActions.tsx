import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Mail, MessageCircle, ShoppingCart } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  computeTotals,
  nextQuoteNumber,
  useFlashQuoteStore,
} from "../store";
import { downloadPdf, generateQuotePdf } from "../lib/pdf";
import { EmailSendModal } from "./EmailSendModal";
import { logger } from "@/lib/logger";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export function QuoteActions() {
  const lines = useFlashQuoteStore((s) => s.lines);
  const client = useFlashQuoteStore((s) => s.client);
  const discount = useFlashQuoteStore((s) => s.discount);
  const vatRate = useFlashQuoteStore((s) => s.vatRate);
  const emittedAt = useFlashQuoteStore((s) => s.emittedAt);
  const validUntil = useFlashQuoteStore((s) => s.validUntil);
  const notes = useFlashQuoteStore((s) => s.notes);
  const quoteNumber = useFlashQuoteStore((s) => s.quoteNumber);
  const setQuoteNumber = useFlashQuoteStore.setState;

  const toast = useToast();
  const navigate = useNavigate();
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState<null | "pdf" | "email" | "wa" | "convert">(null);

  const ensureQuoteNumber = (): string => {
    if (quoteNumber) return quoteNumber;
    const n = nextQuoteNumber();
    setQuoteNumber({ quoteNumber: n });
    return n;
  };

  const validate = (): boolean => {
    if (lines.length === 0) {
      toast.show("Ajoutez au moins une ligne", "error");
      return false;
    }
    if (lines.some((l) => l.quantite < 1)) {
      toast.show("Quantité invalide sur une ligne", "error");
      return false;
    }
    return true;
  };

  const handleDownload = async () => {
    if (!validate()) return;
    setBusy("pdf");
    try {
      const ref = ensureQuoteNumber();
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
      toast.show("Devis téléchargé", "success");
    } catch (err) {
      logger.error(err);
      toast.show("Erreur de génération du PDF", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = () => {
    if (!validate()) return;
    ensureQuoteNumber();
    setEmailOpen(true);
  };

  const handleWhatsApp = () => {
    if (!validate()) return;
    const ref = ensureQuoteNumber();
    const totals = computeTotals({ lines, discount, vatRate });
    const text = [
      `Bonjour${client.nom ? " " + client.nom : ""},`,
      `Voici le devis ${ref} :`,
      `${lines.length} ligne(s) · Total ${fmtMoney(totals.totalTTC)} TTC`,
      `Valable jusqu'au ${validUntil}.`,
    ].join("\n");
    const phone = (client.telephone || "").replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  };

  const handleConvert = () => {
    if (!validate()) return;
    const ref = ensureQuoteNumber();
    const totals = computeTotals({ lines, discount, vatRate });
    // Stash the quote summary so the new-order page can consume it.
    const payload = {
      quoteNumber: ref,
      client,
      lines,
      totalTTC: totals.totalTTC,
      notes,
    };
    try {
      sessionStorage.setItem("oms.flashQuote.convertPayload", JSON.stringify(payload));
    } catch {
      // ignore — sessionStorage may be unavailable
    }
    toast.show(`Devis ${ref} converti en commande`, "success");
    navigate("/orders/new?from=flash-quote");
  };

  const disabled = lines.length === 0;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <ActionButton
          icon={<Mail size={15} />}
          label="Email"
          onClick={handleEmail}
          disabled={disabled || busy !== null}
          loading={busy === "email"}
        />
        <ActionButton
          icon={<MessageCircle size={15} />}
          label="WhatsApp"
          onClick={handleWhatsApp}
          disabled={disabled || busy !== null}
        />
        <ActionButton
          icon={<Download size={15} />}
          label="Télécharger PDF"
          onClick={handleDownload}
          disabled={disabled || busy !== null}
          loading={busy === "pdf"}
          variant="primary"
        />
        <ActionButton
          icon={<ShoppingCart size={15} />}
          label="Convertir en commande"
          onClick={handleConvert}
          disabled={disabled || busy !== null}
        />
      </div>
      <EmailSendModal open={emailOpen} onClose={() => setEmailOpen(false)} />
    </>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  loading,
  variant = "secondary",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 40,
        padding: "0 12px",
        borderRadius: 8,
        background: disabled
          ? isPrimary
            ? "var(--ink-200)"
            : "var(--ink-50)"
          : isPrimary
            ? "var(--accent-500)"
            : "#fff",
        border: isPrimary ? "none" : "1px solid var(--ink-200)",
        color: isPrimary
          ? "var(--fg-on-primary)"
          : disabled
            ? "var(--ink-400)"
            : "var(--ink-800)",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        boxShadow: isPrimary && !disabled ? "var(--shadow-1)" : "none",
        transition: "background 140ms",
      }}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "fq-spin 600ms linear infinite",
          }}
        />
      ) : (
        icon
      )}
      <span>{label}</span>
      <style>{`@keyframes fq-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Keyboard, Save, Zap } from "lucide-react";
import { ModelColumn } from "@/features/flash-devis-v2/components/ModelColumn";
import { BuilderColumn } from "@/features/flash-devis-v2/components/BuilderColumn";
import { SummaryColumn } from "@/features/flash-devis-v2/components/SummaryColumn";
import { ShortcutsCheatSheet } from "@/features/flash-devis-v2/components/ShortcutsCheatSheet";
import { useKeyboardShortcuts } from "@/features/flash-devis-v2/useKeyboardShortcuts";
import { useFlashDevisV2Store } from "@/features/flash-devis-v2/store";
import { useCreateQuote } from "@/hooks/useQuotes";
import { useToast } from "@/components/Toast";

export function FlashDevisV2Page() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const onToggleCheatSheet = useCallback(() => setCheatSheetOpen((v) => !v), []);
  const onCloseCheatSheet = useCallback(() => setCheatSheetOpen(false), []);

  useKeyboardShortcuts({
    searchInputRef,
    cheatSheetOpen,
    onToggleCheatSheet,
    onCloseCheatSheet,
  });

  const selectedModelRef = useFlashDevisV2Store((s) => s.selectedModelRef);
  const selectedClientId = useFlashDevisV2Store((s) => s.selectedClientId);
  const quantity = useFlashDevisV2Store((s) => s.quantity);
  const placements = useFlashDevisV2Store((s) => s.placements);
  const transportActive = useFlashDevisV2Store((s) => s.transportActive);
  const tgcaActive = useFlashDevisV2Store((s) => s.tgcaActive);
  const discount = useFlashDevisV2Store((s) => s.discount);
  const notes = useFlashDevisV2Store((s) => s.notes);
  const reset = useFlashDevisV2Store((s) => s.reset);

  const createQuote = useCreateQuote();

  const canSave =
    selectedModelRef !== null &&
    selectedClientId !== null &&
    quantity >= 1 &&
    !createQuote.isPending;

  async function handleSave() {
    if (!canSave) return;
    try {
      const quote = await createQuote.mutateAsync({
        client_id: selectedClientId!,
        model_ref: selectedModelRef!,
        quantity,
        placements: Array.from(placements),
        transport_active: transportActive,
        tgca_active: tgcaActive,
        discount,
        notes: notes.trim() === "" ? null : notes,
      });
      toast.show(`Devis ${quote.reference} enregistré.`, "success");
      reset();
      navigate("/devis");
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Erreur lors de l'enregistrement.";
      toast.show(detail, "error");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        margin: -24,
        background: "var(--brand-paper, #f4f4f2)",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          background: "rgba(244,244,242,0.85)",
          backdropFilter: "blur(16px) saturate(180%)",
          borderBottom: "1px solid rgba(74,98,116,0.10)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--brand-duck-500)",
            color: "var(--fg-on-primary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--fg-1)",
              letterSpacing: "-0.01em",
            }}
          >
            Devis Flash
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          aria-label="Enregistrer le devis"
          title={
            !selectedModelRef
              ? "Sélectionnez un modèle"
              : !selectedClientId
                ? "Sélectionnez un client"
                : "Enregistrer le devis"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--brand-duck-500)",
            background: canSave ? "var(--brand-duck-500)" : "rgba(74,98,116,0.08)",
            color: canSave ? "var(--fg-on-primary)" : "var(--fg-4)",
            fontSize: 13,
            fontWeight: 600,
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.65,
            transition: "all 120ms ease",
          }}
        >
          <Save size={14} />
          {createQuote.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onToggleCheatSheet}
          aria-label="Afficher les raccourcis clavier"
          title="Raccourcis clavier (?)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(74,98,116,0.18)",
            background: "#fff",
            color: "var(--fg-2)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Keyboard size={14} />
          <span style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
            ?
          </span>
        </button>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "340px minmax(0, 1fr) 360px",
          overflow: "hidden",
        }}
      >
        <ModelColumn searchInputRef={searchInputRef} />
        <BuilderColumn />
        <SummaryColumn />
      </div>

      <ShortcutsCheatSheet open={cheatSheetOpen} onClose={onCloseCheatSheet} />
    </div>
  );
}

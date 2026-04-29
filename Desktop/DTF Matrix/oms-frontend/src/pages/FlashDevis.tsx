import { Zap } from "lucide-react";
import { RefSearchInput } from "@/features/flash-quote/components/RefSearchInput";
import { QuoteLinesTable } from "@/features/flash-quote/components/QuoteLinesTable";
import { QuoteTotals } from "@/features/flash-quote/components/QuoteTotals";
import { ClientFields } from "@/features/flash-quote/components/ClientFields";
import { QuoteActions } from "@/features/flash-quote/components/QuoteActions";
import { useFlashQuoteStore } from "@/features/flash-quote/store";

export function FlashDevisPage() {
  const addLine = useFlashQuoteStore((s) => s.addLine);
  const notes = useFlashQuoteStore((s) => s.notes);
  const setNotes = useFlashQuoteStore((s) => s.setNotes);
  const lineCount = useFlashQuoteStore((s) => s.lines.length);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      {/* Page header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 4,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "var(--accent-500)",
            color: "var(--fg-on-primary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Zap size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: "var(--ink-900)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            Flash Devis
          </h1>
          <div style={{ fontSize: 12.5, color: "var(--ink-500)", fontWeight: 500 }}>
            Devis express depuis le catalogue · auto-sauvegardé
            {lineCount > 0 ? ` · ${lineCount} ligne(s)` : ""}
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="flash-devis-grid"
      >
        {/* LEFT — search + lines + notes */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <Card title="Ajouter une référence">
            <RefSearchInput
              onPick={(p) =>
                addLine({
                  reference: p.reference,
                  designation: p.designation,
                  prixUnitaire: p.defaultPrice,
                  pricingTiers: p.tiers.length ? p.tiers : undefined,
                })
              }
            />
            <div
              style={{
                marginTop: 10,
                fontSize: 11.5,
                color: "var(--ink-500)",
                lineHeight: 1.5,
              }}
            >
              Tapez une référence ou un nom de produit. <kbd style={kbdStyle}>↑</kbd>
              <kbd style={kbdStyle}>↓</kbd> pour naviguer ·{" "}
              <kbd style={kbdStyle}>Entrée</kbd> pour ajouter.
            </div>
          </Card>

          <Card title="Lignes du devis">
            <QuoteLinesTable />
          </Card>

          <Card title="Notes & conditions">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Conditions particulières, délais, modalités de paiement…"
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid var(--ink-200)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--ink-900)",
                fontFamily: "var(--font-text)",
                background: "#fff",
                resize: "vertical",
                outline: "none",
              }}
            />
          </Card>
        </section>

        {/* RIGHT — client info + totals + actions (sticky) */}
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "sticky",
            top: 16,
          }}
        >
          <Card title="Client & dates">
            <ClientFields />
          </Card>

          <QuoteTotals />

          <div
            style={{
              background: "#fff",
              border: "1px solid var(--ink-200)",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <QuoteActions />
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .flash-devis-grid {
            grid-template-columns: 1fr !important;
          }
          .flash-devis-grid > aside {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--ink-200)",
        borderRadius: 12,
        boxShadow: "var(--shadow-1)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-500)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  color: "var(--ink-700)",
  background: "var(--ink-50)",
  border: "1px solid var(--ink-200)",
  borderRadius: 4,
  margin: "0 2px",
};

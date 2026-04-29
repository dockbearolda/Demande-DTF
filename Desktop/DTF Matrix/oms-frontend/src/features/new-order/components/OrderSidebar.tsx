import { memo, useMemo } from "react";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { absoluteMockupUrl } from "@/hooks/useSupplierCatalog";
import { computeTotals, formatEUR } from "../pricing";
import { getQuoteId } from "../quoteId";
import { selectHeader, selectLines, useNewOrderStore } from "../store";
import { isClassicLine, isTextileLine, type OrderLineRecord } from "../types";
import { getTextileModel } from "../runtimeCatalog";

/** TVA standard appliquée sur la ligne « Sous-total HT + Personnalisation ».
 *  Le panel n'a pas de modulation par client/produit aujourd'hui — si la
 *  fiscalité devient variable, ramener cette constante dans `pricing.ts`. */
const VAT_RATE = 0.2;

interface DetailRow {
  /** Clé stable React — `${lineId}::${colorId|"_classic"}`. */
  key: string;
  reference: string | null;
  colorLabel: string | null;
  colorHex: string | null;
  thumbnailUrl: string | null;
  qty: number;
  /** Sous-total HT articles uniquement (sans frais de calage). */
  subtotalHT: number;
}

export const OrderSidebar = memo(function OrderSidebar() {
  return (
    <div
      data-testid="order-sidebar"
      className="hidden flex-col gap-4 lg:sticky lg:top-4 lg:flex lg:self-start"
    >
      <QuoteSummaryCard />
    </div>
  );
});

const QuoteSummaryCard = memo(function QuoteSummaryCard() {
  const header = useNewOrderStore(selectHeader);
  const lines = useNewOrderStore(selectLines);

  const { rows, articlesHT, persoHT } = useMemo(
    () => buildRowsAndTotals(lines),
    [lines],
  );

  const hasDetail = rows.length > 0;
  const totalHT = articlesHT + persoHT;
  const tva = totalHT * VAT_RATE;
  const totalTTC = totalHT + tva;

  const clientName = header.clientNom?.trim() || "";
  const livraisonLabel = formatDateFr(header.dateLivraison);
  const livraisonMode = header.isUrgent ? "Urgent · 48h" : "Standard";

  return (
    <aside aria-label="Récapitulatif du devis">
      <div
        className="rounded-2xl border border-ink-200 bg-white p-4"
        style={{ boxShadow: "var(--shadow-1)" }}
      >
        {/* Header — DEVIS # */}
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "#64748b",
            lineHeight: 1.2,
          }}
        >
          {getQuoteId()}
        </p>

        {/* Bloc Client */}
        <FieldBlock label="Client" animateKey={clientName || "empty"}>
          {clientName ? (
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#202930",
                fontFamily: "var(--font-text)",
                lineHeight: 1.2,
              }}
            >
              {clientName}
            </span>
          ) : (
            <PlaceholderText>—</PlaceholderText>
          )}
        </FieldBlock>

        {/* Bloc Livraison */}
        <FieldBlock label="Livraison">
          {header.dateLivraison ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#202930",
                  fontFamily: "var(--font-text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {livraisonLabel}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontFamily: "var(--font-text)",
                }}
              >
                · {livraisonMode}
              </span>
              {header.isUrgent && <UrgentPill />}
            </div>
          ) : (
            <PlaceholderText>—</PlaceholderText>
          )}
        </FieldBlock>

        <Divider />

        {/* Détail */}
        <SectionLabel>Détail</SectionLabel>
        {hasDetail ? (
          <ul className="mt-2 space-y-2.5">
            {rows.map((row) => (
              <DetailRowItem key={row.key} row={row} />
            ))}
          </ul>
        ) : (
          <p
            className="mt-2"
            style={{
              fontSize: 12,
              color: "#ADB8B9",
              fontFamily: "var(--font-text)",
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            Sélectionne une catégorie pour commencer
          </p>
        )}

        {/* Totaux */}
        {hasDetail && (
          <>
            <Divider />
            <TotalRow label="Sous-total HT" value={formatEUR(articlesHT)} />
            {persoHT > 0 && (
              <TotalRow label="Personnalisation" value={formatEUR(persoHT)} />
            )}
            <TotalRow label="TVA 20%" value={formatEUR(tva)} />
            <Divider thick />
            <div className="flex items-baseline justify-between">
              <span
                className="uppercase"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  fontFamily: "var(--font-text)",
                  letterSpacing: "0.08em",
                }}
              >
                Total TTC
              </span>
              <NumberRoller
                value={formatEUR(totalTTC)}
                fontSize={16}
                className="tabular-nums"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#202930",
                  letterSpacing: "-0.01em",
                }}
              />
            </div>
          </>
        )}
      </div>
    </aside>
  );
});

// ─── Sub-components ────────────────────────────────────────────────────

function DetailRowItem({ row }: { row: DetailRow }) {
  return (
    <li className="flex items-start gap-2.5">
      <Thumb hex={row.colorHex} url={row.thumbnailUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-tight">
          {row.reference && (
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "#3a4e5d",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {row.reference}
            </span>
          )}
          {row.colorLabel && (
            <span
              style={{
                fontFamily: "var(--font-text)",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              · {row.colorLabel}
            </span>
          )}
        </div>
        <div
          className="mt-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#64748b",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {row.qty} pcs
        </div>
      </div>
      <div
        className="flex-none whitespace-nowrap pl-2 text-right"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 500,
          color: "#202930",
          fontVariantNumeric: "tabular-nums",
          transition:
            "color var(--dur-base) var(--ease-snap), opacity var(--dur-base) var(--ease-snap)",
        }}
      >
        {formatEUR(row.subtotalHT)}
      </div>
    </li>
  );
}

function Thumb({ hex, url }: { hex: string | null; url: string | null }) {
  const resolvedUrl = url ? absoluteMockupUrl(url) : null;
  return (
    <div
      aria-hidden="true"
      className="flex-none overflow-hidden"
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: "#F4F4F2",
        backgroundImage: resolvedUrl ? `url(${resolvedUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {!resolvedUrl && hex && (
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: 2,
            backgroundColor: hex,
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        />
      )}
    </div>
  );
}

function FieldBlock({
  label,
  children,
  animateKey,
}: {
  label: string;
  children: React.ReactNode;
  /** Quand fournie, un changement de valeur déclenche l'animation fade-in +
   *  translateY(-2px) sur 220ms (spec récap : sélection client). */
  animateKey?: string;
}) {
  return (
    <div className="mt-3">
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 500,
          fontFamily: "var(--font-text)",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        key={animateKey}
        className="mt-1"
        style={{
          animation: animateKey
            ? "quote-recap-enter var(--dur-base) var(--ease-snap)"
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PlaceholderText({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 15,
        fontWeight: 500,
        color: "#ADB8B9",
        fontFamily: "var(--font-text)",
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#64748b",
        letterSpacing: "0.08em",
        fontFamily: "var(--font-text)",
      }}
    >
      {children}
    </div>
  );
}

function Divider({ thick = false }: { thick?: boolean }) {
  return (
    <hr
      style={{
        margin: thick ? "10px 0 8px" : "12px 0",
        border: 0,
        borderTop: thick
          ? "1px solid var(--ink-200)"
          : "1px dashed var(--ink-200)",
      }}
    />
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span
        style={{
          fontSize: 12,
          color: "#64748b",
          fontFamily: "var(--font-text)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "#202930",
          fontFamily: "var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
          transition: "color var(--dur-base) var(--ease-snap)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function UrgentPill() {
  return (
    <span
      className="uppercase"
      style={{
        fontFamily: "var(--font-text)",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        backgroundColor: "rgba(245,158,11,0.12)",
        color: "#b45309",
        padding: "2px 6px",
        borderRadius: 999,
        lineHeight: 1.2,
      }}
    >
      Urgent
    </span>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDateFr(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Construit les lignes du détail et les totaux à partir des lignes du draft.
 *
 * - Une ligne textile multicolore est éclatée en une row par couleur — chaque
 *   row porte le sous-total = `unitPrice × colorQty`. Le `colorChangeFee` n'est
 *   PAS distribué dans les rows : il alimente le bloc « Personnalisation ».
 * - Les lignes classiques produisent une row unique (`secteur` comme libellé
 *   « couleur »).
 * - Les lignes vides (sans modèle ou sans quantité) sont ignorées.
 */
function buildRowsAndTotals(records: ReadonlyArray<OrderLineRecord>): {
  rows: DetailRow[];
  articlesHT: number;
  persoHT: number;
} {
  const rows: DetailRow[] = [];
  let articlesHT = 0;
  let persoHT = 0;

  for (const r of records) {
    const totals = computeTotals(r.line);
    const articlePart = totals.subtotal - totals.colorChangeFee;
    persoHT += totals.colorChangeFee;

    if (isTextileLine(r.line)) {
      const model = getTextileModel(r.line.modelId);
      // Forme canonique du SKU dans le devis (ex: `H-004_NS308`) — c'est le
      // `ref_label` du fournisseur, fallback côté `model.name` quand le nom
      // commercial est absent. Pour les anciens drafts, `modelName` persisté
      // contient déjà cette valeur.
      const reference =
        r.line.modelName?.trim() || model?.name || model?.id || null;
      const groups = new Map<
        string,
        { label: string; hex: string; mockupUrl: string | null; qty: number }
      >();
      for (const it of Object.values(r.line.items)) {
        if (it.qty <= 0 || it.isPlaceholder) continue;
        const colorInfo = model?.colors.find((c) => c.id === it.color);
        const cur = groups.get(it.color);
        if (cur) {
          cur.qty += it.qty;
        } else {
          groups.set(it.color, {
            label: colorInfo?.label ?? "—",
            hex: colorInfo?.hex ?? "#CDD4CD",
            mockupUrl: colorInfo?.mockupUrl ?? null,
            qty: it.qty,
          });
        }
      }
      if (groups.size === 0) continue;
      articlesHT += articlePart;
      for (const [colorId, c] of groups) {
        rows.push({
          key: `${r.id}::${colorId}`,
          reference,
          colorLabel: c.label,
          colorHex: c.hex,
          thumbnailUrl: c.mockupUrl,
          qty: c.qty,
          subtotalHT: totals.unitPrice * c.qty,
        });
      }
      continue;
    }

    if (isClassicLine(r.line)) {
      const produit = r.line.customProduit?.trim() || r.line.produit;
      if (!produit || r.line.quantity <= 0) continue;
      articlesHT += articlePart;
      rows.push({
        key: `${r.id}::_classic`,
        reference: produit,
        colorLabel: r.line.secteur,
        colorHex: null,
        thumbnailUrl: null,
        qty: r.line.quantity,
        subtotalHT: articlePart,
      });
    }
  }

  return { rows, articlesHT, persoHT };
}

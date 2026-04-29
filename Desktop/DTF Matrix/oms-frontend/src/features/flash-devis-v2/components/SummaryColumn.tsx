import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useCatalogTree } from "@/hooks/useCatalog";
import { usePricing, useGlobalParams } from "@/features/pricing/usePricing";
import type { PricingOutput } from "@/features/pricing";
import { useFlashDevisV2Store } from "../store";
import { formatEur, placementLabel } from "../format";

export function SummaryColumn() {
  const { data: tree } = useCatalogTree();
  const { data: params } = useGlobalParams();

  const selectedRef = useFlashDevisV2Store((s) => s.selectedModelRef);
  const quantity = useFlashDevisV2Store((s) => s.quantity);
  const placements = useFlashDevisV2Store((s) => s.placements);
  const transportActive = useFlashDevisV2Store((s) => s.transportActive);
  const transportTtcUnitOverride = useFlashDevisV2Store((s) => s.transportTtcUnitOverride);
  const tgcaActive = useFlashDevisV2Store((s) => s.tgcaActive);
  const discount = useFlashDevisV2Store((s) => s.discount);

  const product = useMemo(() => {
    if (!tree || !selectedRef) return null;
    for (const fam of tree.families) {
      for (const sf of fam.subfamilies) {
        for (const p of sf.products) {
          if (p.reference === selectedRef) return p;
        }
      }
    }
    return null;
  }, [tree, selectedRef]);

  const matrixName = useMemo(() => {
    if (!product?.pricing_matrix_id || !tree) return undefined;
    return tree.pricing_matrices.find((m) => m.id === product.pricing_matrix_id)?.name;
  }, [product, tree]);

  const { computeQuote } = usePricing(matrixName);

  const out: PricingOutput | null = useMemo(() => {
    if (!product) return null;
    return computeQuote({
      purchasePriceHt: product.purchase_price_ht ?? null,
      quantity,
      placements: Array.from(placements),
      transportActive,
      transportTtcUnit: transportTtcUnitOverride ?? undefined,
      tgcaActive,
      discount,
    });
  }, [computeQuote, product, quantity, placements, transportActive, transportTtcUnitOverride, tgcaActive, discount]);

  const transportTtcUnit = transportTtcUnitOverride ?? (params?.transport_ttc ?? 1.56);

  return (
    <aside
      aria-label="Récapitulatif devis"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        borderLeft: "1px solid rgba(74,98,116,0.10)",
        background: "rgba(244,244,242,0.6)",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--fg-4)",
          }}
        >
          Récapitulatif
        </h2>

        {!product ? (
          <div
            style={{
              padding: "16px 8px",
              fontSize: 13,
              color: "var(--fg-3)",
              textAlign: "center",
            }}
          >
            Aucun modèle sélectionné.
          </div>
        ) : !out ? (
          <div
            style={{
              padding: "16px 8px",
              fontSize: 13,
              color: "var(--fg-3)",
              textAlign: "center",
            }}
          >
            Chargement de la grille tarifaire…
          </div>
        ) : (
          <SummaryDetails
            out={out}
            quantity={quantity}
            transportTtcUnit={transportTtcUnit}
          />
        )}
      </div>
    </aside>
  );
}

function SummaryDetails({
  out,
  quantity,
  transportTtcUnit,
}: {
  out: PricingOutput;
  quantity: number;
  transportTtcUnit: number;
}) {
  const paMissing = out.prixViergeUnit === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row
        label="Palier appliqué"
        value={out.palierApplique !== null ? `≥ ${out.palierApplique} unités` : "—"}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--fg-2)" }}>Vierge / unit</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{formatEur(out.prixViergeUnit)}</span>
          {paMissing && (
            <span
              title="Prix d'achat manquant"
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 999,
                background: "rgba(180,83,9,0.12)",
                color: "var(--accent-warning, #b45309)",
                letterSpacing: "0.04em",
              }}
            >
              PA MANQUANT
            </span>
          )}
        </span>
      </div>

      {out.logos.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingLeft: 4,
            borderLeft: "2px solid rgba(74,98,116,0.10)",
          }}
        >
          {out.logos.map((l) => (
            <div
              key={l.placement}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12.5,
                color: "var(--fg-2)",
              }}
            >
              <span>{placementLabel(l.placement)}</span>
              <span>{formatEur(l.unitPrice)}</span>
            </div>
          ))}
        </div>
      )}

      <Row label="Vente HT / unit" value={formatEur(out.prixVenteHtUnit)} bold />
      <Row label={`Sous-total HT (×${quantity})`} value={formatEur(out.sousTotalHt)} />
      {out.montantTgca > 0 && <Row label="TGCA" value={formatEur(out.montantTgca)} />}
      {out.transportTtc > 0 && (
        <Row
          label={`Transport (${quantity} × ${formatEur(transportTtcUnit)})`}
          value={formatEur(out.transportTtc)}
        />
      )}
      {out.discount > 0 && (
        <Row
          label="Remise commerciale"
          value={`− ${formatEur(out.discount)}`}
          accent="negative"
        />
      )}

      <div
        style={{
          marginTop: 6,
          padding: "12px 14px",
          borderRadius: 12,
          background: "var(--brand-duck-500)",
          color: "var(--fg-on-primary)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>
          TOTAL TTC
        </span>
        <span
          aria-label="Total TTC"
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em",
          }}
        >
          {formatEur(out.totalTtc)}
        </span>
      </div>

      {out.warnings.length > 0 && (
        <div
          role="status"
          style={{
            marginTop: 4,
            padding: "8px 10px",
            background: "rgba(217,177,32,0.12)",
            border: "1px solid rgba(180,83,9,0.30)",
            borderRadius: 8,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 11.5,
            color: "var(--accent-warning, #b45309)",
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.4 }}>
            {out.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: "negative";
}) {
  const isNeg = accent === "negative";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 13,
      }}
    >
      <span style={{ color: isNeg ? "var(--accent-error, #b91c1c)" : "var(--fg-2)" }}>
        {label}
      </span>
      <span
        style={{
          fontWeight: bold || isNeg ? 700 : 500,
          color: isNeg
            ? "var(--accent-error, #b91c1c)"
            : bold
              ? "var(--fg-1)"
              : "var(--fg-2)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

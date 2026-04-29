import { useMemo, useState, useEffect } from "react";
import { useCatalogTree } from "@/hooks/useCatalog";
import { useGlobalParams } from "@/features/pricing/usePricing";
import { useFlashDevisV2Store } from "../store";
import { formatEur } from "../format";
import { ClientSelector } from "./ClientSelector";
import { PlacementChips } from "./PlacementChips";

export function BuilderColumn() {
  const { data: tree } = useCatalogTree();
  const { data: params } = useGlobalParams();

  const selectedRef = useFlashDevisV2Store((s) => s.selectedModelRef);
  const selectedClientId = useFlashDevisV2Store((s) => s.selectedClientId);
  const selectClient = useFlashDevisV2Store((s) => s.selectClient);
  const quantity = useFlashDevisV2Store((s) => s.quantity);
  const placements = useFlashDevisV2Store((s) => s.placements);
  const transportActive = useFlashDevisV2Store((s) => s.transportActive);
  const transportTtcUnitOverride = useFlashDevisV2Store((s) => s.transportTtcUnitOverride);
  const tgcaActive = useFlashDevisV2Store((s) => s.tgcaActive);
  const discount = useFlashDevisV2Store((s) => s.discount);
  const notes = useFlashDevisV2Store((s) => s.notes);

  const selectModel = useFlashDevisV2Store((s) => s.selectModel);
  const setQuantity = useFlashDevisV2Store((s) => s.setQuantity);
  const togglePlacement = useFlashDevisV2Store((s) => s.togglePlacement);
  const setTransportActive = useFlashDevisV2Store((s) => s.setTransportActive);
  const setTransportTtcUnitOverride = useFlashDevisV2Store((s) => s.setTransportTtcUnitOverride);
  const setTgcaActive = useFlashDevisV2Store((s) => s.setTgcaActive);
  const setDiscount = useFlashDevisV2Store((s) => s.setDiscount);
  const setNotes = useFlashDevisV2Store((s) => s.setNotes);

  const selectedProduct = useMemo(() => {
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

  const hasModel = selectedProduct !== null;
  const transportTtcUnitDefault = params?.transport_ttc ?? 1.56;
  const transportTtcUnit = transportTtcUnitOverride ?? transportTtcUnitDefault;
  const transportLineTotal = transportTtcUnit * quantity;
  const tgcaPercent = params ? Math.round(params.taux_tgca * 100) : 4;

  // État local string pour éviter le snap-back lors de la saisie du prix transport
  const [transportInputValue, setTransportInputValue] = useState(
    String(transportTtcUnit)
  );
  useEffect(() => {
    setTransportInputValue(String(transportTtcUnitOverride ?? transportTtcUnitDefault));
  }, [transportTtcUnitOverride, transportTtcUnitDefault]);

  return (
    <section
      aria-label="Builder devis"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Bandeau modèle */}
        <Card>
          {hasModel ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    fontWeight: 700,
                    color: "var(--fg-3)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {selectedProduct.reference}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--fg-1)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {selectedProduct.name}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color:
                      selectedProduct.purchase_price_ht == null
                        ? "var(--accent-warning, #b45309)"
                        : "var(--fg-2)",
                  }}
                >
                  {selectedProduct.purchase_price_ht == null
                    ? "PA non renseigné"
                    : `PA ${formatEur(selectedProduct.purchase_price_ht)}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectModel(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(74,98,116,0.18)",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--fg-2)",
                  cursor: "pointer",
                }}
              >
                Changer
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: "12px 4px",
                textAlign: "center",
                fontSize: 13,
                color: "var(--fg-3)",
              }}
            >
              Sélectionnez un modèle dans la colonne de gauche pour
              commencer.
            </div>
          )}
        </Card>

        {/* Client */}
        <Card title="Client">
          <ClientSelector value={selectedClientId} onChange={selectClient} />
        </Card>

        {/* Quantité */}
        <Card title="Quantité">
          <input
            type="number"
            min={1}
            value={quantity}
            disabled={!hasModel}
            onChange={(e) => setQuantity(Number(e.target.value))}
            aria-label="Quantité"
            style={{
              width: 140,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(74,98,116,0.18)",
              fontSize: 14,
              background: hasModel ? "#fff" : "rgba(74,98,116,0.04)",
              outline: "none",
            }}
          />
        </Card>

        {/* Emplacements logos */}
        <Card title="Emplacements logos">
          <PlacementChips
            active={placements}
            onToggle={togglePlacement}
            disabled={!hasModel}
          />
        </Card>

        {/* Toggles transport / TGCA */}
        <Card title="Options">
          {/* Transport row with editable unit price */}
          <div
            style={{
              padding: "6px 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: hasModel ? 1 : 0.4,
              pointerEvents: hasModel ? "auto" : "none",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 13,
                color: "var(--fg-1)",
                cursor: "pointer",
              }}
            >
              <span style={{ fontWeight: 500 }}>Transport (TTC)</span>
              <input
                type="checkbox"
                checked={transportActive}
                onChange={(e) => setTransportActive(e.target.checked)}
                disabled={!hasModel}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
            </label>
            {transportActive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--fg-2)",
                  paddingLeft: 4,
                }}
              >
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={transportInputValue}
                  onChange={(e) => {
                    setTransportInputValue(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v) && v >= 0) setTransportTtcUnitOverride(v);
                  }}
                  onBlur={() => {
                    const v = parseFloat(transportInputValue);
                    if (!Number.isFinite(v) || v < 0) {
                      setTransportTtcUnitOverride(null);
                      setTransportInputValue(String(transportTtcUnitDefault));
                    }
                  }}
                  aria-label="Prix transport unitaire TTC"
                  style={{
                    width: 72,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(74,98,116,0.22)",
                    fontSize: 13,
                    fontFamily: "var(--font-mono, ui-monospace, monospace)",
                    textAlign: "right",
                    background: "#fff",
                  }}
                />
                <span>€ / unité × {quantity} = <strong>{formatEur(transportLineTotal)}</strong></span>
                {transportTtcUnitOverride !== null && (
                  <button
                    type="button"
                    onClick={() => { setTransportTtcUnitOverride(null); setTransportInputValue(String(transportTtcUnitDefault)); }}
                    title={`Remettre à ${formatEur(transportTtcUnitDefault)}`}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0 2px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: "var(--fg-3)",
                      textDecoration: "underline",
                    }}
                  >
                    reset
                  </button>
                )}
              </div>
            )}
          </div>
          <ToggleRow
            label={`TGCA ${tgcaPercent} %`}
            checked={tgcaActive}
            onChange={setTgcaActive}
            disabled={!hasModel}
          />
        </Card>

        {/* Remise commerciale */}
        <Card title="Remise commerciale">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: hasModel ? "var(--fg-1)" : "var(--fg-4)",
            }}
          >
            <input
              type="number"
              min={0}
              step={0.01}
              value={discount === 0 ? "" : discount}
              disabled={!hasModel}
              onChange={(e) => {
                const v = e.target.value === "" ? 0 : Number(e.target.value);
                setDiscount(v);
              }}
              placeholder="0,00"
              aria-label="Remise commerciale en €"
              style={{
                width: 120,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(74,98,116,0.18)",
                fontSize: 14,
                background: hasModel ? "#fff" : "rgba(74,98,116,0.04)",
                outline: "none",
              }}
            />
            <span>€ TTC sur le total</span>
          </div>
          {discount > 0 && (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--fg-3)",
                fontStyle: "italic",
              }}
            >
              Soustraite au Total TTC final.
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!hasModel}
            rows={3}
            placeholder="Notes internes (non imprimées)…"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(74,98,116,0.18)",
              fontSize: 13,
              fontFamily: "inherit",
              background: hasModel ? "#fff" : "rgba(74,98,116,0.04)",
              resize: "vertical",
              outline: "none",
            }}
          />
        </Card>
      </div>
    </section>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(74,98,116,0.10)",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {title && (
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--fg-4)",
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        fontSize: 13,
        color: disabled ? "var(--fg-4)" : "var(--fg-1)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ width: 18, height: 18, cursor: "inherit" }}
      />
    </label>
  );
}

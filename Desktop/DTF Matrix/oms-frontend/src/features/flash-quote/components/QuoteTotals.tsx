import { useMemo } from "react";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { computeTotals, useFlashQuoteStore } from "../store";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

const MONO: React.CSSProperties["fontFamily"] = "var(--font-mono)";

export function QuoteTotals() {
  const lines = useFlashQuoteStore((s) => s.lines);
  const discount = useFlashQuoteStore((s) => s.discount);
  const vatRate = useFlashQuoteStore((s) => s.vatRate);
  const setDiscountMode = useFlashQuoteStore((s) => s.setDiscountMode);
  const setDiscountValue = useFlashQuoteStore((s) => s.setDiscountValue);
  const setVatRate = useFlashQuoteStore((s) => s.setVatRate);

  const totals = useMemo(
    () => computeTotals({ lines, discount, vatRate }),
    [lines, discount, vatRate],
  );

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--ink-200)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Row
        label="Sous-total HT"
        value={
          <NumberRoller
            value={fmtMoney(totals.subtotalHT)}
            style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}
          />
        }
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={labelStyle}>Remise</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min={0}
            step={discount.mode === "percent" ? 1 : 0.01}
            value={discount.value}
            onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
            aria-label="Valeur de remise"
            style={{
              width: 84,
              height: 30,
              padding: "0 8px",
              border: "1px solid var(--ink-200)",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              color: "var(--ink-900)",
              textAlign: "right",
              outline: "none",
            }}
          />
          <div
            style={{
              display: "inline-flex",
              border: "1px solid var(--ink-200)",
              borderRadius: 6,
              overflow: "hidden",
            }}
            role="tablist"
            aria-label="Mode de remise"
          >
            {(["percent", "amount"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={discount.mode === m}
                onClick={() => setDiscountMode(m)}
                style={{
                  height: 30,
                  padding: "0 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  background:
                    discount.mode === m ? "var(--accent-500)" : "transparent",
                  color:
                    discount.mode === m ? "var(--fg-on-primary)" : "var(--ink-600)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {m === "percent" ? "%" : "€"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {totals.discountAmount > 0 && (
        <Row
          label="Montant remise"
          value={
            <NumberRoller
              value={"− " + fmtMoney(totals.discountAmount)}
              style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}
            />
          }
          muted
        />
      )}

      <div style={{ borderTop: "1px solid var(--ink-100)", margin: "2px 0" }} />

      <Row
        label="Total HT"
        value={
          <NumberRoller
            value={fmtMoney(totals.totalHT)}
            style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700 }}
          />
        }
        bold
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={labelStyle}>TGCA</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min={0}
            step={0.5}
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value) || 0)}
            aria-label="Taux de TGCA"
            style={{
              width: 64,
              height: 30,
              padding: "0 8px",
              border: "1px solid var(--ink-200)",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              color: "var(--ink-900)",
              textAlign: "right",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-500)", width: 12 }}>%</span>
          <span style={{ color: "var(--ink-700)" }}>
            <NumberRoller
              value={fmtMoney(totals.vatAmount)}
              style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}
            />
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 4,
          padding: "12px 14px",
          background: "var(--accent-500)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "var(--fg-on-primary)",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>
          TOTAL TTC
        </span>
        <NumberRoller
          value={fmtMoney(totals.totalTTC)}
          style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800 }}
        />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--ink-600)",
};

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: bold ? 700 : 500,
          color: muted ? "var(--ink-500)" : bold ? "var(--ink-900)" : "var(--ink-600)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: muted ? "var(--ink-500)" : "var(--ink-900)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

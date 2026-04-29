import { memo, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NumberRoller } from "../../../components/ui/NumberRoller";
import { computeTotals, formatEUR } from "../pricing";
import { selectLine, selectLines, useNewOrderStore } from "../store";

interface Props {
  onContinue: () => void;
  submitting?: boolean;
}

export const QuoteStickyFooter = memo(function QuoteStickyFooter({
  onContinue,
  submitting,
}: Props) {
  const line = useNewOrderStore(selectLine);
  const lines = useNewOrderStore(selectLines);
  const validateStep = useNewOrderStore((s) => s.validateStep);

  // Aggregate totals across all lines (multi-reference aware)
  const totals = useMemo(() => {
    if (lines.length > 0) {
      let totalQty = 0;
      let totalSubtotal = 0;
      let validRefs = 0;
      let singleUnitPrice = 0;
      for (const r of lines) {
        const t = computeTotals(r.line);
        totalQty += t.totalQty;
        totalSubtotal += t.subtotal;
        if (t.totalQty > 0) {
          validRefs++;
          singleUnitPrice = t.unitPrice;
        }
      }
      const unitPrice = validRefs === 1 ? singleUnitPrice : 0;
      return { totalQty, subtotal: totalSubtotal, unitPrice, validRefs };
    }
    const t = computeTotals(line);
    return {
      totalQty: t.totalQty,
      subtotal: t.subtotal,
      unitPrice: t.unitPrice,
      validRefs: t.totalQty > 0 ? 1 : 0,
    };
  }, [lines, line]);

  // Reactive validation — re-computes whenever line/lines change.
  // Le footer est rendu sur l'étape 2 (Articles), donc on valide cette étape.
  const validation = useMemo(() => validateStep(2), [validateStep, line, lines]);
  const missingFields = useMemo(
    () => Object.values(validation.fieldErrors).filter(Boolean) as string[],
    [validation.fieldErrors],
  );

  const isDisabled = submitting || !validation.ok;

  const metaParts: string[] = [];
  if (totals.totalQty > 0) {
    metaParts.push(
      `${totals.totalQty} article${totals.totalQty > 1 ? "s" : ""}`,
    );
  }
  if (totals.validRefs > 0) {
    metaParts.push(
      `${totals.validRefs} référence${totals.validRefs > 1 ? "s" : ""}`,
    );
  }
  if (totals.unitPrice > 0 && totals.validRefs <= 1) {
    metaParts.push(`${formatEUR(totals.unitPrice)}/pc`);
  }

  return (
    <div
      className="quote-footer-enter sticky bottom-0 -mx-6 sm:-mx-8"
      style={{
        height: 64,
        backgroundColor: "var(--ink-900)",
        padding: "0 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderRadius: 0,
        // Stretch flush to card edges despite negative margins
        position: "sticky",
      }}
      role="contentinfo"
      aria-label="Récapitulatif et navigation"
    >
      {/* Left — totals */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 500,
              color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1,
            }}
          >
            Total estimé
          </span>
          {totals.subtotal > 0 ? (
            <NumberRoller
              value={formatEUR(totals.subtotal)}
              fontSize={22}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1,
              }}
            >
              —
            </span>
          )}
        </div>
        {metaParts.length > 0 && (
          <span
            style={{
              fontFamily: "var(--font-text)",
              fontSize: 11,
              color: "#CDD4CD",
              lineHeight: 1,
            }}
          >
            {metaParts.join(" · ")}
          </span>
        )}
      </div>

      {/* Right — CTA principale (l'auto-save remplace le bouton brouillon) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <PrimaryCtaWithTooltip
          disabled={isDisabled}
          missingFields={missingFields}
          onClick={onContinue}
        />
      </div>
    </div>
  );
});

// ───────── Primary CTA + hover tooltip ─────────

function PrimaryCtaWithTooltip({
  disabled,
  missingFields,
  onClick,
}: {
  disabled: boolean;
  missingFields: string[];
  onClick: () => void;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const showTooltip = () => {
    if (!disabled || missingFields.length === 0) return;
    const r = wrapperRef.current?.getBoundingClientRect();
    if (!r) return;
    setTooltipPos({
      top: r.top - 8,
      left: r.left + r.width / 2,
    });
    setTooltipVisible(true);
  };

  const hideTooltip = () => setTooltipVisible(false);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocusCapture={showTooltip}
      onBlurCapture={hideTooltip}
      style={{ position: "relative" }}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-disabled={disabled}
        style={{
          height: 36,
          padding: "0 16px",
          borderRadius: "var(--r-2)",
          border: "none",
          background: "#4A6274",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "var(--font-text)",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          transition: "opacity 120ms var(--ease-snap)",
        }}
      >
        Continuer · Personnalisation →
      </button>

      {tooltipVisible &&
        tooltipPos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
              backgroundColor: "var(--ink-800)",
              color: "#ffffff",
              borderRadius: "var(--r-2)",
              padding: "8px 12px",
              fontSize: 12,
              fontFamily: "var(--font-text)",
              maxWidth: 260,
              boxShadow: "var(--shadow-3)",
              pointerEvents: "none",
            }}
          >
            <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
              {missingFields.map((msg, i) => (
                <li key={i} style={{ lineHeight: 1.5 }}>
                  {msg}
                </li>
              ))}
            </ul>
            {/* Arrow pointing down */}
            <div
              style={{
                position: "absolute",
                bottom: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 10,
                height: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: "var(--ink-800)",
                  transform: "rotate(45deg) translate(-35%, -35%)",
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

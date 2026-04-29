import { Trash2 } from "lucide-react";
import { useFlashQuoteStore, PLACEMENT_LABELS, type PlacementType } from "../store";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

const PLACEMENTS: PlacementType[] = ["av", "ar", "av+ar", "m1", "m2"];

export function QuoteLinesTable() {
  const lines = useFlashQuoteStore((s) => s.lines);
  const updateLine = useFlashQuoteStore((s) => s.updateLine);
  const removeLine = useFlashQuoteStore((s) => s.removeLine);

  if (lines.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--ink-500)",
          background: "var(--ink-25)",
          border: "1px dashed var(--ink-200)",
          borderRadius: 10,
        }}
      >
        Aucune ligne. Saisissez une référence ci-dessus pour commencer.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--ink-200)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <style>{`
        .fq-input::-webkit-inner-spin-button,
        .fq-input::-webkit-outer-spin-button { display: none }
        .fq-chip {
          height: 24px;
          padding: 0 9px;
          border-radius: 12px;
          border: 1px solid var(--ink-200);
          background: var(--ink-50);
          color: var(--ink-600);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 80ms, color 80ms, border-color 80ms;
          font-family: var(--font-text);
        }
        .fq-chip:hover { background: var(--ink-100); border-color: var(--ink-300); }
        .fq-chip.active {
          background: var(--accent-500);
          border-color: var(--accent-500);
          color: #fff;
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "92px 1fr 88px 110px 110px 36px",
          gap: 8,
          padding: "10px 12px",
          background: "var(--ink-50)",
          borderBottom: "1px solid var(--ink-200)",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--ink-500)",
        }}
      >
        <div>Réf.</div>
        <div>Désignation</div>
        <div>Qté</div>
        <div>PU HT</div>
        <div style={{ textAlign: "right" }}>Total HT</div>
        <div />
      </div>

      {/* Rows */}
      {lines.map((line, idx) => {
        const total = line.prixUnitaire * line.quantite;
        const isLast = idx === lines.length - 1;
        return (
          <div
            key={line.id}
            style={{
              borderBottom: isLast ? "none" : "1px solid var(--ink-100)",
              background: idx % 2 === 0 ? "transparent" : "var(--ink-25)",
            }}
          >
            {/* Main row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "92px 1fr 88px 110px 110px 36px",
                gap: 8,
                padding: "10px 12px 6px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={line.reference}
              >
                {line.reference}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ink-800)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={line.designation}
              >
                {line.designation}
              </div>
              <input
                type="number"
                min={1}
                step={1}
                value={line.quantite}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v < 1) return;
                  updateLine(line.id, { quantite: Math.floor(v) });
                }}
                aria-label={`Quantité pour ${line.reference}`}
                className="fq-input"
                style={inputStyle}
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={line.prixUnitaire}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v < 0) return;
                  updateLine(line.id, { prixUnitaire: v });
                }}
                aria-label={`Prix unitaire pour ${line.reference}`}
                className="fq-input"
                style={inputStyle}
              />
              <div
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-900)",
                }}
              >
                {fmtMoney(total)}
              </div>
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                aria-label={`Supprimer la ligne ${line.reference}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: "var(--ink-400)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--danger-100)";
                  e.currentTarget.style.color = "var(--danger-500)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--ink-400)";
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Placement chips */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "0 12px 9px",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-400)",
                  marginRight: 2,
                  whiteSpace: "nowrap",
                }}
              >
                Placement
              </span>
              {PLACEMENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`fq-chip${line.placement === p ? " active" : ""}`}
                  onClick={() =>
                    updateLine(line.id, {
                      placement: line.placement === p ? undefined : p,
                    })
                  }
                  aria-pressed={line.placement === p}
                >
                  {PLACEMENT_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 8px",
  border: "1px solid var(--ink-200)",
  borderRadius: 6,
  background: "#fff",
  fontSize: 13,
  fontFamily: "var(--font-mono)",
  color: "var(--ink-900)",
  outline: "none",
  appearance: "textfield",
  MozAppearance: "textfield",
};

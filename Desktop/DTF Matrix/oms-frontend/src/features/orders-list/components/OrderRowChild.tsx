import type { ChildRow } from "../state/expandRow";
import { SecteurTag } from "./SecteurTag";

interface Props {
  row: ChildRow;
}

const FORMAT_EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Sous-ligne (1 par référence). Affichage condensé avec breakdown inline
 * (couleur · taille · qté), tabular-nums et `--fg-3` pour rester secondaire.
 */
export function OrderRowChild({ row }: Props) {
  const { line, breakdown } = row;
  const subtotal = (Number(line.prix_unitaire) || 0) * (Number(line.quantite) || 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: "100%",
        padding: "0 12px 0 56px", // décalé sous le chevron parent
        fontSize: 11.5,
        color: "var(--fg-3)",
        background: "rgba(107,129,145,0.04)",
        borderBottom: "1px solid rgba(74,98,116,0.06)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span aria-hidden="true" style={{ color: "var(--fg-4)", flexShrink: 0 }}>
        ↳
      </span>
      <SecteurTag secteurs={[line.secteur]} size="sm" />
      <span
        style={{
          fontWeight: 600,
          color: "var(--fg-2)",
          maxWidth: 240,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        title={line.produit}
      >
        {line.produit}
      </span>

      {breakdown ? (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0, flex: 1 }}>
          {breakdown.map((b, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 3,
                color: "var(--fg-3)",
              }}
            >
              {b.color && (
                <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>
                  {b.color}
                </span>
              )}
              {b.size && <span style={{ color: "var(--fg-3)" }}>{b.size}</span>}
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--fg-2)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ×{b.qty}
              </span>
            </span>
          ))}
        </span>
      ) : (
        <span style={{ flex: 1, color: "var(--fg-4)", minWidth: 0 }}>
          {line.notes ? (
            <span title={line.notes} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
              {line.notes}
            </span>
          ) : (
            <span style={{ fontStyle: "italic" }}>—</span>
          )}
        </span>
      )}

      <span style={{ flexShrink: 0, fontWeight: 600, color: "var(--fg-2)" }}>
        ×{line.quantite}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontWeight: 600,
          color: "var(--fg-2)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 64,
          textAlign: "right",
        }}
      >
        {FORMAT_EUR.format(subtotal)}
      </span>
    </div>
  );
}

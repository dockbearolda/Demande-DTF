import type { CatalogProduct } from "@/lib/catalog";
import { formatEur } from "../format";

interface Props {
  product: CatalogProduct;
  active: boolean;
  onSelect: () => void;
}

export function ProductCard({ product, active, onSelect }: Props) {
  const pa = product.purchase_price_ht ?? null;
  const paMissing = pa === null || pa === undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        textAlign: "left",
        gap: 4,
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${
          active ? "var(--brand-duck-500)" : "rgba(74,98,116,0.12)"
        }`,
        background: active ? "rgba(107,129,145,0.10)" : "#fff",
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontWeight: 700,
            color: "var(--fg-1)",
            letterSpacing: "0.02em",
          }}
        >
          {product.reference}
        </span>
        <span
          title={paMissing ? "Prix d'achat manquant" : undefined}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: paMissing ? "var(--accent-warning, #b45309)" : "var(--fg-2)",
          }}
        >
          {paMissing ? "—" : `PA ${formatEur(pa)}`}
        </span>
      </div>
      <span
        style={{
          fontSize: 12.5,
          color: "var(--fg-2)",
          lineHeight: 1.35,
          letterSpacing: "-0.005em",
        }}
      >
        {product.name}
      </span>
    </button>
  );
}

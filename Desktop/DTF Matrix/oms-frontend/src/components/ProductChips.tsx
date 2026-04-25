import { useState } from "react";

const CHIP_ACTIVE: React.CSSProperties = {
  background: "var(--brand-duck-500)",
  color: "var(--fg-on-primary)",
  border: "1px solid transparent",
};
const CHIP_IDLE: React.CSSProperties = {
  background: "var(--brand-paper-hi)",
  color: "var(--fg-2)",
  border: "1px solid var(--brand-sage-100)",
};
const CHIP_DASHED: React.CSSProperties = {
  background: "transparent",
  color: "var(--fg-3)",
  border: "1px dashed var(--brand-sage-100)",
};

interface ProductChipsProps {
  value: string;
  onChange: (value: string) => void;
  presets: string[];
}

export function ProductChips({ value, onChange, presets }: ProductChipsProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customProduct, setCustomProduct] = useState("");

  function handleSelectPreset(product: string) {
    onChange(product);
    setShowCustom(false);
  }

  function handleCustomSubmit() {
    if (customProduct.trim()) {
      onChange(customProduct);
      setCustomProduct("");
      setShowCustom(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((product) => (
          <button
            key={product}
            type="button"
            onClick={() => handleSelectPreset(product)}
            style={value === product ? CHIP_ACTIVE : CHIP_IDLE}
            className="rounded-full px-3 py-1 text-sm font-medium transition"
          >
            {product}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          style={CHIP_DASHED}
          className="rounded-full px-3 py-1 text-sm font-medium transition"
        >
          + Autre…
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customProduct}
            onChange={(e) => setCustomProduct(e.target.value)}
            placeholder="Entrer un produit personnalisé"
            className="flex-1 rounded-md px-2 py-1 text-sm"
            style={{ border: "1px solid var(--brand-sage-100)", background: "var(--brand-paper)", color: "var(--fg-1)" }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            className="rounded-md px-2 py-1 text-xs font-medium"
            style={{ background: "var(--brand-duck-500)", color: "var(--fg-on-primary)" }}
          >
            Ajouter
          </button>
        </div>
      )}

      {value && !presets.includes(value) && (
        <div
          className="rounded-md px-2 py-1 text-xs"
          style={{
            background: "color-mix(in srgb, var(--brand-duck-500) 10%, transparent)",
            color: "var(--brand-duck-500)",
          }}
        >
          Produit: {value}
        </div>
      )}
    </div>
  );
}

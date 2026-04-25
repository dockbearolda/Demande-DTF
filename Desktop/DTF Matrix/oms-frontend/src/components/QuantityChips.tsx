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

interface QuantityChipsProps {
  value: number;
  onChange: (value: number) => void;
  presets: number[];
}

export function QuantityChips({ value, onChange, presets }: QuantityChipsProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customQuantity, setCustomQuantity] = useState("");

  function handleSelectPreset(qty: number) {
    onChange(qty);
    setShowCustom(false);
  }

  function handleCustomSubmit() {
    const qty = parseInt(customQuantity, 10);
    if (!isNaN(qty) && qty > 0) {
      onChange(qty);
      setCustomQuantity("");
      setShowCustom(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((qty) => (
          <button
            key={qty}
            type="button"
            onClick={() => handleSelectPreset(qty)}
            style={value === qty ? CHIP_ACTIVE : CHIP_IDLE}
            className="rounded-full px-3 py-1 text-sm font-medium transition"
          >
            {qty}
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
            type="number"
            value={customQuantity}
            onChange={(e) => setCustomQuantity(e.target.value)}
            placeholder="Entrer une quantité"
            min="1"
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

      {value > 0 && !presets.includes(value) && (
        <div
          className="rounded-md px-2 py-1 text-xs"
          style={{
            background: "color-mix(in srgb, var(--brand-duck-500) 10%, transparent)",
            color: "var(--brand-duck-500)",
          }}
        >
          Quantité: {value}
        </div>
      )}
    </div>
  );
}

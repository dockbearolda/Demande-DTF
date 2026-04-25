import { SecteurChips } from "./SecteurChips";
import { ProductChips } from "./ProductChips";
import { QuantityChips } from "./QuantityChips";

interface OrderLine {
  ligne_numero: number;
  secteur: string;
  produit: string;
  quantite: number;
  notes: string;
}

interface OrderLineFormProps {
  line: OrderLine;
  index: number;
  onUpdate: (index: number, updates: Partial<OrderLine>) => void;
  onDelete: (index: number) => void;
  secteurs: string[];
  products: string[];
  quantities: number[];
}

export function OrderLineForm({
  line,
  index,
  onUpdate,
  onDelete,
  secteurs,
  products,
  quantities,
}: OrderLineFormProps) {
  return (
    <div
      className="space-y-3 p-4"
      style={{ border: "1px solid var(--brand-sage-100)", borderRadius: "var(--r-2)" }}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium" style={{ color: "var(--fg-1)" }}>
          Ligne {index + 1}
        </h4>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-xs font-medium"
          style={{ color: "var(--color-danger)" }}
        >
          ✕ Supprimer
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Secteur *
        </label>
        <SecteurChips
          value={line.secteur}
          onChange={(secteur) => onUpdate(index, { secteur })}
          options={secteurs}
        />
      </div>

      <div>
        <label className="block text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Produit *
        </label>
        <ProductChips
          value={line.produit}
          onChange={(produit) => onUpdate(index, { produit })}
          presets={products}
        />
      </div>

      <div>
        <label className="block text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Quantité *
        </label>
        <QuantityChips
          value={line.quantite}
          onChange={(quantite) => onUpdate(index, { quantite })}
          presets={quantities}
        />
      </div>

      <div>
        <label className="block text-xs font-medium" style={{ color: "var(--fg-3)" }}>
          Notes (par ligne)
          <textarea
            value={line.notes}
            onChange={(e) => onUpdate(index, { notes: e.target.value })}
            placeholder="Ex : logo couleur dos, livraison atelier uniquement…"
            rows={2}
            className="mt-1 block w-full rounded-md px-2 py-1 text-sm"
            style={{
              border: "1px solid var(--brand-sage-100)",
              background: "var(--brand-paper)",
              color: "var(--fg-1)",
            }}
          />
        </label>
      </div>
    </div>
  );
}

import { describe, expect, it } from "vitest";
import { describeLine } from "../components/OrderLineCardCollapsed";
import type { ClassicLine, TextileLine } from "../types";

describe("describeLine — collapsed-card summary", () => {
  it("classic: surfaces produit + secteur + quantity", () => {
    const line: ClassicLine = {
      kind: "classic",
      secteur: "DTF",
      produit: "Sticker rond",
      quantity: 50,
      prixUnitaire: 1.2,
    };
    const sum = describeLine(line);
    expect(sum.title).toBe("Sticker rond");
    expect(sum.reference).toBe("DTF");
    expect(sum.declensions).toContain("50");
  });

  it("classic: prefers customProduit when present", () => {
    const line: ClassicLine = {
      kind: "classic",
      secteur: "Goodies",
      produit: "Autre",
      customProduit: "Mug céramique",
      quantity: 12,
      prixUnitaire: 0,
    };
    expect(describeLine(line).title).toBe("Mug céramique");
  });

  it("textile: groups items by color and truncates beyond 3 colors", () => {
    const line: TextileLine = {
      kind: "textile",
      target: "HOMME",
      modelId: "homme-eco",
      modelName: "T-shirt ECO",
      design: { front: null, back: null, sleeves: null, skipped: false },
      bodyPlacements: [],
      items: {
        a: { id: "a", color: "black", size: "M", qty: 12 },
        b: { id: "b", color: "white", size: "M", qty: 8 },
        c: { id: "c", color: "navy", size: "L", qty: 4 },
        d: { id: "d", color: "red", size: "L", qty: 2 },
      },
    };
    const sum = describeLine(line);
    expect(sum.title).toBe("T-shirt ECO");
    // 4 distinct colors → first 3 visible + "+1"
    expect(sum.declensions).toContain("+1");
    expect(sum.declensions.split("·")).toHaveLength(4); // 3 colors + "+1"
  });

  it("textile: returns 'Aucune déclinaison' when there are no items", () => {
    const line: TextileLine = {
      kind: "textile",
      target: "HOMME",
      modelId: "x",
      modelName: "T-shirt X",
      design: { front: null, back: null, sleeves: null, skipped: false },
      bodyPlacements: [],
      items: {},
    };
    expect(describeLine(line).declensions).toBe("Aucune déclinaison");
  });
});

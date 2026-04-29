/**
 * Tests du moteur TS — miroir exact de tests/test_pricing_engine.py.
 *
 * Les valeurs attendues sont identiques au pytest backend : si un test
 * casse ici sans casser pytest, c'est que les deux moteurs ont divergé.
 *
 * Étape 4-bis : transport TTC × qty, TGCA marchandise seule, remise.
 */
import { describe, expect, it } from "vitest";
import {
  computeQuote,
  findPalier,
  type LogoPlacement,
  type PricingInput,
  type PricingTier,
} from "../pricingEngine";

// ── Grille Textile 2026 (snapshot identique à 0021) ──────────────────
const TEXTILE_2026_TIERS: PricingTier[] = [
  { minQty: 1,   coef: 3.80, coeur: 9.50, poitrine: 10.93, avantPlein: 16.20, arrierePlein: 16.20, mancheG: 9.50, mancheD: 9.50 },
  { minQty: 5,   coef: 2.09, coeur: 6.37, poitrine: 7.33,  avantPlein: 12.10, arrierePlein: 12.10, mancheG: 6.37, mancheD: 6.37 },
  { minQty: 10,  coef: 1.91, coeur: 5.10, poitrine: 5.86,  avantPlein: 10.80, arrierePlein: 10.80, mancheG: 5.10, mancheD: 5.10 },
  { minQty: 20,  coef: 1.82, coeur: 4.47, poitrine: 5.14,  avantPlein:  9.45, arrierePlein:  9.45, mancheG: 4.47, mancheD: 4.47 },
  { minQty: 30,  coef: 1.73, coeur: 4.07, poitrine: 4.69,  avantPlein:  8.10, arrierePlein:  8.10, mancheG: 4.07, mancheD: 4.07 },
  { minQty: 40,  coef: 1.64, coeur: 3.82, poitrine: 4.40,  avantPlein:  7.60, arrierePlein:  7.60, mancheG: 3.82, mancheD: 3.82 },
  { minQty: 50,  coef: 1.55, coeur: 3.57, poitrine: 4.11,  avantPlein:  7.30, arrierePlein:  7.30, mancheG: 3.57, mancheD: 3.57 },
  { minQty: 60,  coef: 1.50, coeur: 3.44, poitrine: 3.96,  avantPlein:  7.00, arrierePlein:  7.00, mancheG: 3.44, mancheD: 3.44 },
  { minQty: 70,  coef: 1.46, coeur: 3.32, poitrine: 3.82,  avantPlein:  6.80, arrierePlein:  6.80, mancheG: 3.32, mancheD: 3.32 },
  { minQty: 80,  coef: 1.37, coeur: 3.19, poitrine: 3.67,  avantPlein:  6.50, arrierePlein:  6.50, mancheG: 3.19, mancheD: 3.19 },
  { minQty: 90,  coef: 1.32, coeur: 3.05, poitrine: 3.51,  avantPlein:  6.20, arrierePlein:  6.20, mancheG: 3.05, mancheD: 3.05 },
  { minQty: 100, coef: 1.27, coeur: 2.93, poitrine: 3.36,  avantPlein:  5.90, arrierePlein:  5.90, mancheG: 2.93, mancheD: 2.93 },
  { minQty: 150, coef: 1.27, coeur: 2.80, poitrine: 3.22,  avantPlein:  5.70, arrierePlein:  5.70, mancheG: 2.80, mancheD: 2.80 },
];


// ─── findPalier — règles §2.2 ────────────────────────────────────────

describe("findPalier", () => {
  const cases: Array<[number, number]> = [
    [1, 1],
    [4, 1],
    [5, 5],
    [9, 5],
    [10, 10],
    [19, 10],
    [20, 20],
    [25, 20],   // §6.3
    [29, 20],
    [30, 30],
    [49, 40],
    [50, 50],
    [89, 80],
    [90, 90],
    [99, 90],
    [100, 100],
    [149, 100],
    [150, 150],
    [200, 150], // §6.4
    [10000, 150],
  ];
  it.each(cases)("qty=%i → palier minQty=%i", (qty, expected) => {
    const t = findPalier(qty, TEXTILE_2026_TIERS);
    expect(t).not.toBeNull();
    expect(t!.minQty).toBe(expected);
  });

  it("qty < 1 returns null", () => {
    expect(findPalier(0, TEXTILE_2026_TIERS)).toBeNull();
    expect(findPalier(-5, TEXTILE_2026_TIERS)).toBeNull();
  });

  it("empty grid returns null", () => {
    expect(findPalier(10, [])).toBeNull();
  });
});


// ─── compute_quote — critères d'acceptation §6 (révisés) ──────────────

function ns300Input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    purchasePriceHt: 4.05,
    quantity: 30,
    placements: ["Coeur"] as LogoPlacement[],
    tiers: TEXTILE_2026_TIERS,
    transportTtcUnit: 1.56,
    transportActive: true,
    tgcaActive: false,
    tgcaRate: 0.04,
    discount: 0,
    ...overrides,
  };
}

describe("computeQuote — critères §6 (révisés étape 4-bis)", () => {
  it("§6.1 NS300 qty=30 Cœur TGCA off → 379,20 € TTC (transport ×qty)", () => {
    const out = computeQuote(ns300Input());
    expect(out.palierApplique).toBe(30);
    expect(out.coef).toBe(1.73);
    expect(out.prixViergeUnit).toBe(7.01);
    expect(out.logos).toHaveLength(1);
    expect(out.logos[0].placement).toBe("Coeur");
    expect(out.logos[0].unitPrice).toBe(4.07);
    expect(out.prixLogosUnit).toBe(4.07);
    expect(out.prixVenteHtUnit).toBe(11.08);
    expect(out.sousTotalHt).toBe(332.40);
    // Transport ligne = 30 × 1,56
    expect(out.transportTtc).toBe(46.80);
    expect(out.montantTgca).toBe(0);
    expect(out.discount).toBe(0);
    expect(out.totalAvantRemise).toBe(379.20);
    expect(out.totalTtc).toBe(379.20);
  });

  it("§6.2 même cas avec TGCA on → 392,50 € TTC (TGCA sur marchandise)", () => {
    const out = computeQuote(ns300Input({ tgcaActive: true }));
    expect(out.palierApplique).toBe(30);
    expect(out.sousTotalHt).toBe(332.40);
    expect(out.transportTtc).toBe(46.80);
    // TGCA = 332,40 × 0,04 = 13,296 → 13,30
    expect(out.montantTgca).toBe(13.30);
    expect(out.totalAvantRemise).toBe(392.50);
    expect(out.totalTtc).toBe(392.50);
  });

  it("§6.3 qty=25 → palier 20 (coef 1,82)", () => {
    const out = computeQuote(ns300Input({ quantity: 25 }));
    expect(out.palierApplique).toBe(20);
    expect(out.coef).toBe(1.82);
    expect(out.prixViergeUnit).toBe(7.37);
  });

  it("§6.4 qty=200 → palier 150 (coef 1,27)", () => {
    const out = computeQuote(ns300Input({ quantity: 200 }));
    expect(out.palierApplique).toBe(150);
    expect(out.coef).toBe(1.27);
  });
});


// ─── Variantes additionnelles ────────────────────────────────────────

describe("computeQuote — variantes", () => {
  it("aucun emplacement → logos vides, vierge × qty + transport × qty", () => {
    const out = computeQuote(ns300Input({ placements: [] }));
    expect(out.logos).toEqual([]);
    expect(out.prixLogosUnit).toBe(0);
    // 7,01 × 30 = 210,30 ; transport 30 × 1,56 = 46,80 → 257,10
    expect(out.totalTtc).toBe(257.10);
  });

  it("6 emplacements simultanés au palier 50", () => {
    const out = computeQuote(
      ns300Input({
        quantity: 50,
        placements: [
          "Coeur",
          "Poitrine",
          "AvantPlein",
          "ArrierePlein",
          "MancheG",
          "MancheD",
        ],
      }),
    );
    expect(out.palierApplique).toBe(50);
    // 3.57 + 4.11 + 7.30 + 7.30 + 3.57 + 3.57 = 29.42
    expect(out.prixLogosUnit).toBe(29.42);
    // Vierge unit = 4.05 × 1.55 = 6.2775 → 6.28
    expect(out.prixViergeUnit).toBe(6.28);
    expect(out.prixVenteHtUnit).toBe(35.70);
  });

  it("transport désactivé → total = sous-total HT marchandise", () => {
    const out = computeQuote(ns300Input({ transportActive: false }));
    expect(out.transportTtc).toBe(0);
    expect(out.totalTtc).toBe(332.40);
  });

  it("PA absent → warnings, vierge=null, total = transport seul (× qty)", () => {
    const out = computeQuote(ns300Input({ purchasePriceHt: null }));
    expect(out.prixViergeUnit).toBeNull();
    expect(out.prixVenteHtUnit).toBeNull();
    expect(
      out.warnings.some((w) => w.toLowerCase().includes("achat")),
    ).toBe(true);
    // 30 × 1,56 = 46,80
    expect(out.transportTtc).toBe(46.80);
    expect(out.totalTtc).toBe(46.80);
  });

  it("qty=0 → empty output avec warning", () => {
    const out = computeQuote(ns300Input({ quantity: 0 }));
    expect(out.palierApplique).toBeNull();
    expect(out.totalTtc).toBe(0);
    expect(out.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("emplacement inconnu → warning, mais Cœur toujours pris", () => {
    const out = computeQuote(
      ns300Input({
        placements: [
          "Coeur",
          "InvalidPlacement" as unknown as LogoPlacement,
        ],
      }),
    );
    expect(out.logos.some((l) => l.placement === "Coeur")).toBe(true);
    expect(
      out.warnings.some(
        (w) => w.includes("Emplacement inconnu") || w.includes("manquant"),
      ),
    ).toBe(true);
  });

  it("taux TGCA custom (10 %) sur marchandise seule", () => {
    const out = computeQuote(
      ns300Input({ tgcaActive: true, tgcaRate: 0.10 }),
    );
    // marchandise = 332,40, TGCA = 33,24 ; transport = 46,80 → 412,44
    expect(out.montantTgca).toBe(33.24);
    expect(out.totalTtc).toBe(412.44);
  });

  it("rétrocompat lecture : palier sans coef (legacy vierge/dos) → warning", () => {
    const legacy: PricingTier[] = [
      { minQty: 1, vierge: 12.0, dos: 5.0 } as PricingTier,
    ];
    const out = computeQuote(
      ns300Input({ tiers: legacy, placements: [] }),
    );
    expect(out.coef).toBeNull();
    expect(out.prixViergeUnit).toBeNull();
    expect(
      out.warnings.some((w) => w.toLowerCase().includes("coef")),
    ).toBe(true);
  });
});


// ─── Remise commerciale (étape 4-bis) ────────────────────────────────

describe("computeQuote — remise commerciale", () => {
  it("remise 50 € sur 379,20 → total 329,20 €", () => {
    const out = computeQuote(ns300Input({ discount: 50 }));
    expect(out.totalAvantRemise).toBe(379.20);
    expect(out.discount).toBe(50);
    expect(out.totalTtc).toBe(329.20);
  });

  it("sans remise (défaut 0), total avant et total final identiques", () => {
    const out = computeQuote(ns300Input());
    expect(out.discount).toBe(0);
    expect(out.totalAvantRemise).toBe(out.totalTtc);
  });

  it("remise > total → plafonnée, total = 0, warning", () => {
    const out = computeQuote(ns300Input({ discount: 9999 }));
    expect(out.discount).toBe(379.20);
    expect(out.totalTtc).toBe(0);
    expect(out.warnings.some((w) => w.toLowerCase().includes("plafonn"))).toBe(true);
  });

  it("remise négative → ignorée, warning, total inchangé", () => {
    const out = computeQuote(ns300Input({ discount: -50 }));
    expect(out.discount).toBe(0);
    expect(out.totalTtc).toBe(379.20);
    expect(out.warnings.some((w) => w.toLowerCase().includes("négative"))).toBe(true);
  });

  it("remise + TGCA combinées (392,50 − 100 = 292,50)", () => {
    const out = computeQuote(
      ns300Input({ tgcaActive: true, discount: 100 }),
    );
    expect(out.totalAvantRemise).toBe(392.50);
    expect(out.discount).toBe(100);
    expect(out.totalTtc).toBe(292.50);
  });
});

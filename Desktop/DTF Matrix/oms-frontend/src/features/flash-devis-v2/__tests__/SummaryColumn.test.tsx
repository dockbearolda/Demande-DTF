import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  computeQuote as realComputeQuote,
  type LogoPlacement,
  type PricingTier,
} from "@/features/pricing";
import { useFlashDevisV2Store } from "../store";
import { SummaryColumn } from "../components/SummaryColumn";

// ── Grille Textile 2026 (snapshot identique aux tests pricingEngine) ───
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

const FAKE_PRODUCT = {
  id: "p-ns300",
  subfamily_id: "sf",
  reference: "NS300",
  name: "T-Shirt NS300",
  description: null,
  image_url: null,
  pricing_matrix_id: "mx-textile-2026",
  position: 0,
  enabled: true,
  colors: [],
  sizes: [],
  purchase_price_ht: 4.05,
  sleeve_type: "courte" as const,
  neck_type: "rond" as const,
};

const FAKE_TREE = {
  families: [
    {
      id: "fam",
      slug: "textile",
      label: "Textile",
      icon: "Shirt",
      position: 0,
      enabled: true,
      subfamilies: [
        {
          id: "sf",
          family_id: "fam",
          slug: "tshirt",
          label: "T-Shirts",
          target: null,
          position: 0,
          enabled: true,
          products: [FAKE_PRODUCT],
        },
      ],
    },
  ],
  pricing_matrices: [
    {
      id: "mx-textile-2026",
      name: "Textile 2026",
      currency: "EUR",
      tiers: TEXTILE_2026_TIERS,
    },
  ],
};

// ── Mocks de hooks ────────────────────────────────────────────────────

vi.mock("@/hooks/useCatalog", () => ({
  useCatalogTree: () => ({ data: FAKE_TREE, isLoading: false }),
}));

vi.mock("@/features/pricing/usePricing", () => ({
  usePricing: (_matrixName?: string) => ({
    matrix: FAKE_TREE.pricing_matrices[0],
    params: { id: 1, transport_ttc: 1.56, taux_tgca: 0.04, created_at: "", updated_at: "" },
    isReady: true,
    computeQuote: (args: {
      purchasePriceHt: number | null;
      quantity: number;
      placements: readonly LogoPlacement[];
      transportActive?: boolean;
      tgcaActive?: boolean;
      discount?: number;
    }) =>
      realComputeQuote({
        purchasePriceHt: args.purchasePriceHt,
        quantity: args.quantity,
        placements: args.placements,
        tiers: TEXTILE_2026_TIERS,
        transportTtcUnit: 1.56,
        transportActive: args.transportActive ?? true,
        tgcaActive: args.tgcaActive ?? false,
        tgcaRate: 0.04,
        discount: args.discount ?? 0,
      }),
  }),
  useGlobalParams: () => ({
    data: { id: 1, transport_ttc: 1.56, taux_tgca: 0.04 },
  }),
  usePricingMatrices: () => ({ data: FAKE_TREE.pricing_matrices }),
}));

// ── Helpers ────────────────────────────────────────────────────────────

function configureStore(opts: {
  ref?: string | null;
  qty?: number;
  placements?: LogoPlacement[];
  transportActive?: boolean;
  tgcaActive?: boolean;
  discount?: number;
}) {
  const s = useFlashDevisV2Store.getState();
  s.reset();
  if (opts.ref !== undefined) s.selectModel(opts.ref);
  if (opts.qty !== undefined) s.setQuantity(opts.qty);
  for (const p of opts.placements ?? []) s.togglePlacement(p);
  if (opts.transportActive !== undefined) s.setTransportActive(opts.transportActive);
  if (opts.tgcaActive !== undefined) s.setTgcaActive(opts.tgcaActive);
  if (opts.discount !== undefined) s.setDiscount(opts.discount);
}

beforeEach(() => {
  useFlashDevisV2Store.getState().reset();
});

afterEach(() => {
  cleanup();
  useFlashDevisV2Store.getState().reset();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("SummaryColumn", () => {
  it("affiche un placeholder quand aucun modèle n'est sélectionné", () => {
    render(<SummaryColumn />);
    expect(screen.getByText(/aucun modèle sélectionné/i)).toBeInTheDocument();
  });

  it("§6.1 (révisé) NS300 qty 30 + Cœur + TGCA off → Total TTC 379,20 €", () => {
    configureStore({
      ref: "NS300",
      qty: 30,
      placements: ["Coeur"],
      transportActive: true,
      tgcaActive: false,
    });
    render(<SummaryColumn />);
    const total = screen.getByLabelText("Total TTC");
    expect(total.textContent).toMatch(/379[\s ,]20\s*€/);
  });

  it("§6.2 (révisé) NS300 qty 30 + Cœur + TGCA on → Total TTC 392,50 €", () => {
    configureStore({
      ref: "NS300",
      qty: 30,
      placements: ["Coeur"],
      transportActive: true,
      tgcaActive: true,
    });
    render(<SummaryColumn />);
    const total = screen.getByLabelText("Total TTC");
    expect(total.textContent).toMatch(/392[\s ,]50\s*€/);
  });

  it("remise commerciale 50 € → Total TTC 329,20 € + ligne « Remise »", () => {
    configureStore({
      ref: "NS300",
      qty: 30,
      placements: ["Coeur"],
      discount: 50,
    });
    render(<SummaryColumn />);
    const total = screen.getByLabelText("Total TTC");
    expect(total.textContent).toMatch(/329[\s ,]20\s*€/);
    expect(screen.getByText(/Remise commerciale/i)).toBeInTheDocument();
  });

  it("affiche les lignes logos pour chaque emplacement coché", () => {
    configureStore({
      ref: "NS300",
      qty: 30,
      placements: ["Coeur", "MancheG"],
    });
    render(<SummaryColumn />);
    expect(screen.getByText("Cœur")).toBeInTheDocument();
    expect(screen.getByText("Manche G")).toBeInTheDocument();
  });

  it("affiche le palier appliqué", () => {
    configureStore({ ref: "NS300", qty: 25 });
    render(<SummaryColumn />);
    expect(screen.getByText(/≥ 20 unités/)).toBeInTheDocument();
  });
});

/**
 * Hook React pour le calcul de devis live (<100 ms).
 *
 * Charge la grille tarifaire et les paramètres globaux via React Query
 * (cache long), puis expose `computeQuote()` synchrone : aucun appel
 * HTTP au moment du calcul, tout est local.
 *
 * Le backend reste source de vérité : valider les montants côté serveur
 * via POST /pricing/compute lors de l'enregistrement d'un devis.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  computeQuote as computeQuoteEngine,
  type LogoPlacement,
  type PricingInput,
  type PricingOutput,
  type PricingTier,
} from "./pricingEngine";

const STALE_MS = 5 * 60_000; // 5 min — la grille bouge rarement

const DEFAULT_MATRIX_NAME = "Textile 2026";

interface PricingMatrixApi {
  id: string;
  name: string;
  currency: string;
  tiers: PricingTier[];
}

interface ParametresGlobauxApi {
  id: number;
  transport_ttc: number;
  taux_tgca: number;
  created_at: string;
  updated_at: string;
}

const KEY_MATRICES = ["pricing", "matrices"] as const;
const KEY_PARAMS = ["pricing", "parametres"] as const;

export function usePricingMatrices() {
  return useQuery<PricingMatrixApi[]>({
    queryKey: KEY_MATRICES,
    queryFn: async () =>
      (await api.get<PricingMatrixApi[]>("/catalog/pricing-matrices")).data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useGlobalParams() {
  return useQuery<ParametresGlobauxApi>({
    queryKey: KEY_PARAMS,
    queryFn: async () =>
      (await api.get<ParametresGlobauxApi>("/admin/parametres")).data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export interface ComputeQuoteArgs {
  /** PA HT du modèle (null si non renseigné). */
  purchasePriceHt: number | null;
  quantity: number;
  placements: readonly LogoPlacement[];
  transportActive?: boolean;
  tgcaActive?: boolean;
  /** Remise commerciale TTC (montant fixe en €). */
  discount?: number;
  /** Override grille (défaut : « Textile 2026 »). */
  matrixName?: string;
  /** Override des paramètres (utile pour tests, sinon pris du backend). */
  transportTtcUnit?: number;
  tgcaRate?: number;
}

export interface UsePricingResult {
  /** Grille active (« Textile 2026 » par défaut). */
  matrix: PricingMatrixApi | undefined;
  params: ParametresGlobauxApi | undefined;
  isReady: boolean;
  /** Calcul synchrone — peut être appelé sur chaque keystroke. */
  computeQuote: (args: ComputeQuoteArgs) => PricingOutput | null;
}

/**
 * Hook principal. Renvoie `computeQuote` synchrone une fois grille + params
 * chargés. Tant que `isReady === false`, `computeQuote` retourne `null`.
 */
export function usePricing(matrixName: string = DEFAULT_MATRIX_NAME): UsePricingResult {
  const { data: matrices } = usePricingMatrices();
  const { data: params } = useGlobalParams();

  const matrix = useMemo(
    () => matrices?.find((m) => m.name === matrixName),
    [matrices, matrixName],
  );

  const isReady = matrix !== undefined && params !== undefined;

  const computeQuote = useCallback(
    (args: ComputeQuoteArgs): PricingOutput | null => {
      // Si l'utilisateur force une matrice différente, on la cherche dans le cache.
      const targetMatrix = args.matrixName
        ? matrices?.find((m) => m.name === args.matrixName)
        : matrix;
      if (!targetMatrix || !params) return null;

      const input: PricingInput = {
        purchasePriceHt: args.purchasePriceHt,
        quantity: args.quantity,
        placements: args.placements,
        tiers: targetMatrix.tiers,
        transportTtcUnit: args.transportTtcUnit ?? params.transport_ttc,
        transportActive: args.transportActive ?? true,
        tgcaActive: args.tgcaActive ?? false,
        tgcaRate: args.tgcaRate ?? params.taux_tgca,
        discount: args.discount ?? 0,
      };
      return computeQuoteEngine(input);
    },
    [matrix, matrices, params],
  );

  return { matrix, params, isReady, computeQuote };
}

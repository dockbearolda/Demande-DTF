/** Helpers de formatage pour Devis Flash v2. */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return EUR.format(value);
}

const PLACEMENT_LABELS: Record<string, string> = {
  Coeur: "Cœur",
  Poitrine: "Poitrine",
  AvantPlein: "Avant plein",
  ArrierePlein: "Arrière plein",
  MancheG: "Manche G",
  MancheD: "Manche D",
};

export function placementLabel(p: string): string {
  return PLACEMENT_LABELS[p] ?? p;
}
